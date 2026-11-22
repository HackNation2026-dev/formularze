"""Document -> FormSpec using a local LLM: one global call, then one call per page chunk."""

from __future__ import annotations

import logging
import re

from rapidfuzz import fuzz

from formgen.compose.dictionaries import dictionary_for, with_proposed
from formgen.compose.spec import ApplicantKinds, Condition, FieldSpec, FormSpec, PageSpec, SectionSpec
from formgen.config import Settings
from formgen.extract.llm_client import LlmClient, make_client
from formgen.extract.prompts import GLOBAL_USER, SECTIONS_USER, SYSTEM
from formgen.extract.schema import LlmChunk, LlmGlobal, LlmSection
from formgen.ingest import Document, load
from formgen.schema.model import FieldType, Validator

log = logging.getLogger("formgen.extract")

CHUNK_CHARS = 4500  # ~1.5k tokens of Polish text per call; keeps each answer short enough for a 12 tok/s box
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
        sections: list[LlmSection] = []
        for pages, text in chunks(doc):
            sections.extend(self._sections_for(client, pages, text))
        spec = to_spec(g, sections, full, with_validators=settings.with_validators)
        if not spec.title.strip():
            spec.title = filename.rsplit(".", 1)[0]
        return spec

    def _sections_for(self, client: LlmClient, pages: str, text: str, depth: int = 0) -> list[LlmSection]:
        """One constrained call per chunk. A truncated or malformed answer (small models hit max_tokens on
        dense pages) is retried on the two halves of the chunk; a chunk that still fails is skipped, so one bad
        page never discards the whole form."""
        try:
            return client.complete(
                SYSTEM, SECTIONS_USER.format(pages=pages, text=text), LlmChunk, max_tokens=2048
            ).sections
        except ValueError as exc:
            if depth >= 2 or len(text) < 1200:
                log.warning("chunk %s skipped after invalid LLM output: %s", pages, str(exc)[:120])
                return []
            log.info("chunk %s invalid (%s); retrying as two halves", pages, str(exc)[:80])
            cut = text.rfind("\n", 0, len(text) // 2) or len(text) // 2
            return self._sections_for(client, pages + "a", text[:cut], depth + 1) + self._sections_for(
                client, pages + "b", text[cut:], depth + 1
            )


def chunks(doc: Document) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    cur_pages: list[int] = []
    cur = ""
    for p in doc.pages:
        t = doc.to_prompt_text([p.number])
        if cur and len(cur) + len(t) > CHUNK_CHARS:
            out.append((f"strony {cur_pages[0]}-{cur_pages[-1]}", cur))
            cur_pages, cur = [], ""
        cur_pages.append(p.number)
        cur += ("\n" if cur else "") + t
    if cur:
        out.append((f"strony {cur_pages[0]}-{cur_pages[-1]}", cur))
    return out


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
    return any(k in low for k in ADDRESS_LABELS) and bool(APPLICANT_SECTION_RE.search(section_title))


def to_spec(g: LlmGlobal, sections: list[LlmSection], source_text: str, *, with_validators: bool) -> FormSpec:
    pages: dict[str, PageSpec] = {}
    dropped: list[str] = []
    extra_consents: list[tuple[str, bool]] = []
    for s in sections:
        if (
            NOISE_SECTION_RE.search(s.title)
            or NOISE_SECTION_RE.search(s.page_title)
            or TEMPLATE_SECTION_RE.search(s.title.strip())
        ):
            dropped.append(f"noise-section:{s.title}")
            continue
        if CONSENT_SECTION_RE.search(s.title.strip()):
            for f in s.fields:
                if grounded(f.label, source_text):
                    extra_consents.append((f.label.strip().rstrip(":"), f.required))
            continue
        fields: list[FieldSpec] = []
        for f in s.fields:
            if not re.search(r"[^\W_]{2,}", f.label):  # no real word: '', '____', '...', '-'
                dropped.append(f"empty-label:{f.label!r}")
                continue
            if is_template_label(f.label, s.title) and f.kind not in ("FILE_UPLOADER",):
                dropped.append(f"template:{f.label}")
                continue
            if not grounded(f.label, source_text):
                dropped.append(f"ungrounded:{f.label}")
                continue
            kind = FieldType(f.kind)
            yes_no = {o.strip().lower() for o in f.options} <= {"tak", "nie", "yes", "no"}
            if (
                kind in (FieldType.RADIO, FieldType.CHECKBOX)
                and ATTACHMENT_RE.search(f.label)
                and f.options
                and not yes_no
            ):
                for opt in f.options:
                    if opt.strip() and not FILL_ONLY.match(opt) and grounded(opt, source_text):
                        fields.append(FieldSpec(label=opt.strip(), kind=FieldType.FILE_UPLOADER, required=False))
                continue
            if kind in (FieldType.RADIO, FieldType.CHECKBOX, FieldType.SELECT) and len(f.options) < 2:
                kind = FieldType.FILE_UPLOADER if ATTACHMENT_RE.search(f.label) else FieldType.TEXT_FIELD
            if any(x.label.lower() == f.label.strip().rstrip(":").lower() for x in fields):
                dropped.append(f"duplicate:{f.label}")
                continue
            validators = [Validator(f.validator)] if f.validator else []
            dictionary = (
                dictionary_for(f.label) if kind in (FieldType.TEXT_FIELD, FieldType.SELECT, FieldType.RADIO) else None
            )
            if dictionary:  # predefined dictionaries attach only to a drop-down list
                kind = FieldType.SELECT
            fields.append(
                with_proposed(
                    FieldSpec(
                        label=f.label.strip().rstrip(":"),
                        kind=kind,
                        options=[o.strip() for o in f.options if o.strip()],
                        required=f.required,
                        validators=validators,
                        description=f.description.strip(),
                        visible_when=_cond(f.visible_when),
                        dictionary=dictionary,
                    )
                )
            )
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
                visible_when=_cond(s.visible_when),
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
FILL_ONLY = re.compile(r"^[\s_.…-]*$")
ATTACHMENT_RE = re.compile(r"załączni|w załączeniu|\bplik|dokument|dołącz|kopi[ae]\b|odpis", re.I)
CONSENT_SECTION_RE = re.compile(r"^(zgod|oświadcz)", re.I)
TEMPLATE_SECTION_RE = re.compile(r"^dane do kontaktu$|^kontakt|^dane kontaktowe|^twoje dane|^dane wnioskodawcy$", re.I)
NOISE_SECTION_RE = re.compile(
    r"wyjaśnien|objaśnien|instrukc|pouczen|\brodo\b|przetwarzan|klauzul|adnotacj|wypełnia (organ|urząd|pracownik)|informacj[ae] o przetwarzaniu|administrator|podstawa prawna|termin składania",
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


def _cond(c) -> list[Condition]:
    if c is None or not c.field_label.strip() or not c.equals.strip():
        return []
    return [Condition(field=c.field_label.strip(), value=c.equals.strip())]
