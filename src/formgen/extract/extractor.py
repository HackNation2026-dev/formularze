"""Document -> FormSpec using a local LLM: one global call, then one call per page chunk."""

from __future__ import annotations

import logging
import re

from rapidfuzz import fuzz

from formgen.compose.dictionaries import dictionary_for, proposed_for, with_proposed
from formgen.compose.spec import ApplicantKinds, Condition, FieldSpec, FormSpec, PageSpec, SectionSpec
from formgen.config import Settings
from formgen.extract.llm_client import LlmClient, make_client
from formgen.extract.prompts import GLOBAL_USER, SECTIONS_USER, SYSTEM
from formgen.extract.schema import LlmChunk, LlmCondition, LlmField, LlmGlobal, LlmSection
from formgen.ingest import Document, load
from formgen.schema.model import FieldType, Validator

log = logging.getLogger("formgen.extract")

Lines = dict[int, str]  # numbered source line -> its text (Document.numbered_lines)

CHUNK_CHARS = 4500  # ~1.5k tokens of Polish text per call; keeps each answer short enough for a 12 tok/s box
# Qwen3.5 reads Polish form text at 2.8-3.2 chars per token; 2.5 overestimates the prompt, so the answer budget
# never pushes prompt + answer past the slot context (llama.cpp then stops with finish=length mid-JSON)
CHARS_PER_TOKEN = 2.5
TEMPLATE_TOKENS = 64  # chat template around system + user
MIN_ANSWER_TOKENS = 1024  # below this a chunk is split before the call instead of truncated after it
GROUNDING_MIN = 60
# labels the template already covers; dropped if the LLM still emits them
IDENTITY_LABELS = (
    "imię",
    "nazwisko",
    "pesel",
    "nip",
    "regon",
    "krs",
    "nazwa firmy",
    "nazwa podmiotu",
    "telefon",
    "e-mail",
    "email",
    "adres poczty",
    "podpis",
    "data wypełnienia",
    "data złożenia",
    "pełnomocnik",
    "reprezentant",
    "zgoda na przetwarzanie",
    "klauzula",
    "oświadczam",
    "dowodu osobistego",
    "seria i numer",
)
ADDRESS_LABELS = (
    "adres zamieszkania",
    "adres siedziby",
    "adres korespondencyjny",
    "adres do korespondencji",
    "miejscowość",
    "ulica",
    "kod pocztowy",
    "numer domu",
    "nr domu",
    "numer lokalu",
    "nr lokalu",
    "województwo",
    "powiat",
    "gmina",
    "kraj",
)
APPLICANT_SECTION_RE = re.compile(
    r"wnioskodawc|dane osobowe|dane identyfikacyjne|zamieszkania|siedzib|korespondenc|pełnomocni|reprezentant|podmiot|składając|kontakt",
    re.I,
)
# a section about the property itself ("Dane wnioskodawcy i adres nieruchomości") keeps its address fields
SUBJECT_SECTION_RE = re.compile(r"nieruchomoś|budyn|lokaliz|działk|obręb|posesj", re.I)


class LlmExtractor:
    def __init__(self, client: LlmClient | None = None):
        self.client = client

    def extract(self, data: bytes, kind: str, filename: str, settings: Settings) -> FormSpec:
        doc = load(data, kind, tika_url=settings.doc_converter_url)
        return self.extract_document(doc, filename, settings)

    def extract_document(self, doc: Document, filename: str, settings: Settings) -> FormSpec:
        client = self.client or make_client(settings)
        full = doc.to_prompt_text()
        g = client.complete(SYSTEM, GLOBAL_USER.format(text=full[: CHUNK_CHARS * 2]), LlmGlobal, max_tokens=512)
        sections: list[tuple[LlmSection, Lines]] = []
        for pages, text, lines in chunks(doc):
            sections.extend((s, lines) for s in self._sections_for(client, pages, text, settings.llm_context_tokens))
        spec = to_spec(g, sections, full, with_validators=settings.with_validators)
        if not spec.title.strip():
            spec.title = filename.rsplit(".", 1)[0]
        return spec

    def _sections_for(
        self, client: LlmClient, pages: str, text: str, context_tokens: int, depth: int = 0
    ) -> list[LlmSection]:
        """One constrained call per chunk; the answer may use all context the prompt leaves free. A chunk whose
        prompt leaves less than MIN_ANSWER_TOKENS, or whose answer is still truncated or malformed, is retried on
        its two halves; a chunk that still fails is skipped, so one bad page never discards the whole form."""
        user = SECTIONS_USER.format(pages=pages, text=text)
        budget = answer_budget(SYSTEM + user, context_tokens)
        try:
            if budget < MIN_ANSWER_TOKENS:
                raise ValueError(f"prompt leaves {budget} of {context_tokens} context tokens for the answer")
            return client.complete(SYSTEM, user, LlmChunk, max_tokens=budget).sections
        except ValueError as exc:
            if depth >= 2 or len(text) < 1200:
                log.warning("chunk %s skipped after invalid LLM output: %s", pages, str(exc)[:120])
                return []
            log.info("chunk %s invalid (%s); retrying as two halves", pages, str(exc)[:80])
            cut = text.rfind("\n", 0, len(text) // 2) or len(text) // 2
            return self._sections_for(client, pages + "a", text[:cut], context_tokens, depth + 1) + (
                self._sections_for(client, pages + "b", text[cut:], context_tokens, depth + 1)
            )


def answer_budget(prompt: str, context_tokens: int) -> int:
    """Tokens left for the answer after a conservative estimate of the prompt."""
    return context_tokens - int(len(prompt) / CHARS_PER_TOKEN) - TEMPLATE_TOKENS


def chunks(doc: Document) -> list[tuple[str, str, Lines]]:
    """Page groups of about CHUNK_CHARS (measured without line numbers): (label, numbered text, its lines)."""
    groups: list[list[int]] = []
    size = 0
    for p in doc.pages:
        n = len(doc.to_prompt_text([p.number]))
        if groups and size + n > CHUNK_CHARS:
            groups.append([])
            size = 0
        if not groups:
            groups.append([])
        groups[-1].append(p.number)
        size += n + 1
    return [(f"strony {g[0]}-{g[-1]}", doc.to_prompt_text(g, numbered=True), doc.numbered_lines(g)) for g in groups]


FILL_MARK_RE = re.compile(r"____|☐")
CAPTION_RE = re.compile(r"^\s*\([^()]*\)[\s\d)*]*$")
ADDRESS_VALUE_RE = re.compile(r"\b\d{2}-\d{3}\b|\bul\. \w+ \d", re.I)
ENUM_PREFIX_RE = re.compile(
    r"^(\d{1,2}(\.\d{1,2})*[\)\.]|[A-Z](\.\d{1,2})+[\)\.]?|[A-Z]\d{1,2}[\)\.]?|[a-zA-Z][\)\.]|[IVX]{1,4}\.)(\s+|$)"
)


def clean(text: str) -> str:
    """Source line -> label or option text: no '## ', boxes, enumeration, fills, table pipes or trailing ':'."""
    t = text.replace("## ", " ").replace("☐", " ").replace("☑", " ").replace("____", " ")
    t = " ".join(c.strip() for c in t.split("|") if c.strip())
    t = re.sub(r"\s+", " ", t).strip()
    while (stripped := ENUM_PREFIX_RE.sub("", t)) != t:
        t = stripped
    t = t.strip(" :;,.-–")
    return t[:1].upper() + t[1:]


def grounded(label: str, text: str) -> bool:
    """A field label must be supported by the source text (anti-hallucination, SafePassage-style)."""
    key = re.sub(r"[^\w ]", " ", label.lower()).strip()
    if len(key) < 3:
        return False
    return fuzz.partial_token_set_ratio(key, text.lower()) >= GROUNDING_MIN


def is_template_label(label: str, section_title: str = "") -> bool:
    """Identity labels are always template-owned; address labels only inside applicant-type sections
    (an address of the *property* in 'Lokalizacja budynku' is subject data and must stay)."""
    low = label.lower()
    if any(k in low for k in IDENTITY_LABELS):
        return True
    return (
        any(k in low for k in ADDRESS_LABELS)
        and bool(APPLICANT_SECTION_RE.search(section_title))
        and not SUBJECT_SECTION_RE.search(section_title)
    )


def to_spec(
    g: LlmGlobal, sections: list[tuple[LlmSection, Lines]], source_text: str, *, with_validators: bool
) -> FormSpec:
    """Each section comes with its chunk's numbered lines; a field whose line is outside them is dropped."""
    pages: dict[str, PageSpec] = {}
    dropped: list[str] = []
    extra_consents: list[tuple[str, bool]] = []
    # a condition names its controlling field by line; a choice field wins when a line carries several fields
    labels = {
        f.line: _label(f, lines)
        for s, lines in sections
        for f in sorted(s.fields, key=lambda f: bool(f.option_lines))
        if f.line in lines
    }
    for s, lines in sections:
        if (
            NOISE_SECTION_RE.search(s.title)
            or NOISE_SECTION_RE.search(s.page_title)
            or TEMPLATE_SECTION_RE.search(s.title.strip())
        ):
            dropped.append(f"noise-section:{s.title}")
            continue
        if CONSENT_SECTION_RE.search(s.title.strip()):
            extra_consents.extend((x, f.required) for f in s.fields if f.line in lines and (x := _label(f, lines)))
            continue
        fields: list[FieldSpec] = []
        for f in s.fields:
            if f.line not in lines:
                dropped.append(f"bad-line:{f.line}")
                continue
            label = _label(f, lines)  # per field: one line may carry several ("w miejscowości ____ przy ulicy ____")
            if not re.search(r"[^\W_]{2,}", label) or not (
                re.search(r"[^\W_]{2,}", clean(lines[f.line])) or _labels_neighbour(f, lines)
            ):
                dropped.append(f"empty-line:{f.line}")  # no real word: '', '____', '...', '-'
                continue
            if ADDRESS_VALUE_RE.search(lines[f.line]):
                dropped.append(f"address-value:{f.line}")  # a printed address (the office's) is data, not a field
                continue
            if is_template_label(label, s.title) and f.kind not in ("FILE_UPLOADER",):
                dropped.append(f"template:{label}")
                continue
            options = [o for n in f.option_lines if n in lines and (o := clean(lines[n]))]
            kind = FieldType(f.kind)
            description = f.description.strip()
            if kind == FieldType.TEXT_BLOCK:
                if any(FILL_MARK_RE.search(lines.get(n, "")) for n in (f.line, *f.option_lines)):
                    kind = FieldType.RADIO if options else FieldType.TEXT_FIELD  # something to fill is no block
                elif CAPTION_RE.match(lines[f.line]):
                    dropped.append(f"caption-block:{f.line}")  # '(adres)' names the fill line above it
                    continue
                else:
                    description = description or clean(lines[f.line])  # a block shows only its description
            yes_no = {o.lower() for o in options} <= {"tak", "nie", "yes", "no"}
            if kind in (FieldType.RADIO, FieldType.CHECKBOX) and ATTACHMENT_RE.search(label) and options and not yes_no:
                fields.extend(FieldSpec(label=o, kind=FieldType.FILE_UPLOADER, required=False) for o in options)
                continue
            if kind in (FieldType.RADIO, FieldType.CHECKBOX, FieldType.SELECT) and len(options) < 2:
                kind = FieldType.FILE_UPLOADER if ATTACHMENT_RE.search(label) else FieldType.TEXT_FIELD
            if any(x.label.lower() == label.lower() for x in fields):
                dropped.append(f"duplicate:{label}")
                continue
            validators = [Validator(f.validator)] if f.validator else []
            dictionary = (
                dictionary_for(label) if kind in (FieldType.TEXT_FIELD, FieldType.SELECT, FieldType.RADIO) else None
            )
            if dictionary:  # predefined dictionaries attach only to a drop-down list
                kind = FieldType.SELECT
            spec = with_proposed(
                FieldSpec(
                    label=label,
                    kind=kind,
                    options=options,
                    required=f.required,
                    validators=validators,
                    description=description,
                    visible_when=_cond(f.visible_when, labels, lines),
                    dictionary=dictionary,
                )
            )
            proposed = proposed_for(label)
            if (
                proposed
                and spec.options == list(proposed.values)
                and any(x.options == spec.options and x.visible_when == spec.visible_when for x in fields)
            ):
                dropped.append(f"duplicate-dictionary:{label}")  # one list the model pointed at from several lines
                continue
            fields.append(spec)
        if not fields:
            continue
        page_title = s.page_title.strip() or "Przedmiot wniosku"
        page = pages.setdefault(page_title, PageSpec(title=page_title))
        title = s.title.strip() or page.title
        same = next((x for x in page.sections if x.title.lower() == title.lower()), None)
        if same is not None:  # small models sometimes emit one section twice; merge instead of _2 suffixes
            known = {x.label.lower() for x in same.fields}
            same.fields.extend(f for f in fields if f.label.lower() not in known)
            continue
        page.sections.append(
            SectionSpec(
                title=title,
                description=s.description.strip(),
                fields=fields,
                repeating=s.repeating,
                visible_when=_cond(s.visible_when, labels, lines),
            )
        )
    if dropped:
        log.info("dropped %d LLM fields: %s", len(dropped), dropped[:12])
    if not pages:
        pages["Przedmiot wniosku"] = PageSpec(
            title="Przedmiot wniosku",
            sections=[
                SectionSpec(title="Treść wniosku", fields=[FieldSpec(label="Treść wniosku", kind=FieldType.TEXTAREA)])
            ],
        )
    page_list = _cap_pages(list(pages.values()), MAX_SUBJECT_PAGES)
    return FormSpec(
        title=g.title.strip()[:255],
        office_name=g.office_name.strip(),
        office_is_organ=g.office_is_organ,
        applicant=applicant_kinds(source_text, g),
        identity_source="MLPZ",
        include_pesel=True,
        pages=page_list,
        extra_consents=extra_consents,
        with_validators=with_validators,
    )


PERSON_RE = re.compile(r"\bpesel\b|\bimi[eę]\b|\bnazwisk", re.I)
LEGAL_RE = re.compile(
    r"\bnip\b|\bregon\b|\bkrs\b|nazwa (firmy|podmiotu|organizacji|klubu|spółki|instytucji)|siedzib|osob[ay] prawn|jednostk[ai] organizacyjn|reprezentant|podmiot",
    re.I,
)
ATTACHMENT_RE = re.compile(r"załączni|w załączeniu|\bplik|dokument|dołącz|kopi[ae]\b|odpis", re.I)
CONSENT_SECTION_RE = re.compile(r"^(zgod|oświadcz)", re.I)
TEMPLATE_SECTION_RE = re.compile(r"^dane do kontaktu$|^kontakt|^dane kontaktowe|^twoje dane|^dane wnioskodawcy$", re.I)
NOISE_SECTION_RE = re.compile(
    r"wyjaśnien|objaśnien|instrukc|pouczen|\brodo\b|przetwarzan|klauzul|adnotacj|wypełnia (organ|urząd|pracownik)|informacj[ae] o przetwarzaniu|administrator|podstawa prawna|termin składania|dane urzęd|urzędow|adresat",
    re.I,
)
MAX_SUBJECT_PAGES = 5
PROXY_RE = re.compile(r"pełnomocni|osoby upoważnionej|w imieniu", re.I)


def applicant_kinds(source_text: str, g: LlmGlobal | None = None) -> ApplicantKinds:
    """Who may file: decided from the paper form's own vocabulary (deterministic), LLM only as tie-breaker.

    COI standard: a form that collects both natural-person data (PESEL, imię) and organisation data
    (NIP, REGON, nazwa) must offer all three options: own name / another person / legal entity."""
    person = bool(PERSON_RE.search(source_text))
    legal = bool(LEGAL_RE.search(source_text))
    proxy = bool(PROXY_RE.search(source_text))
    if not person and not legal and g is not None:
        person, legal = g.applicant_self or not g.applicant_legal_entity, g.applicant_legal_entity
    self_person = person or not legal
    other = (
        (self_person and legal)
        or (self_person and proxy)
        or (g is not None and g.applicant_other_person and self_person)
    )
    return ApplicantKinds(self_person=self_person, other_person=other, legal_entity=legal)


def _cap_pages(pages: list[PageSpec], limit: int) -> list[PageSpec]:
    """Small models like one page per section; the standard wants thematic pages. Merge the smallest
    adjacent pair until at most ``limit`` subject pages remain (first page's title wins)."""
    pages = [p for p in pages if p.sections]
    while len(pages) > limit:
        i = min(range(len(pages) - 1), key=lambda k: len(pages[k].sections) + len(pages[k + 1].sections))
        pages[i].sections.extend(pages[i + 1].sections)
        del pages[i + 1]
    return pages


def _label(f: LlmField, lines: Lines) -> str:
    """The override when the source supports it, else the cleaned line text."""
    override = f.label.strip().rstrip(":").strip()
    return override if override and grounded(override, " ".join(lines.values())) else clean(lines[f.line])


def _labels_neighbour(f: LlmField, lines: Lines) -> bool:
    """A fill-only line ('____') right under or over the line its override names: the model pointed at the fill."""
    near = " ".join(lines.get(n, "") for n in (f.line - 1, f.line + 1))
    return bool(f.label.strip()) and bool(near.strip()) and grounded(f.label, near)


def _cond(c: LlmCondition | None, labels: dict[int, str], lines: Lines) -> list[Condition]:
    if c is None or not labels.get(c.field_line) or c.option_line not in lines:
        return []
    value = clean(lines[c.option_line])
    return [Condition(field=labels[c.field_line], value=value)] if value else []
