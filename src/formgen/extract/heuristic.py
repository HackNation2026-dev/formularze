"""No-LLM extractor: Document -> FormSpec from layout signals only (fills, boxes, headings, keywords).

Safety net when the LLM sidecar is down or too slow, and the baseline the LLM must beat.
"""

from __future__ import annotations

import re

from formgen.api.settings import Settings
from formgen.compose.dictionaries import dictionary_for, with_proposed
from formgen.compose.spec import FieldSpec, FormSpec, PageSpec, SectionSpec
from formgen.extract.extractor import applicant_kinds, is_template_label
from formgen.extract.schema import LlmGlobal
from formgen.ingest import Document, load
from formgen.schema.model import FieldType, Validator

NOISE_RE = re.compile(
    r"^(na podstawie|pouczenie|podstawa prawna|termin składania|składający:|instrukcja|wypełnij|wypełniaj|strona \d|\d+/\d+$|załącznik nr|"
    r"podpis|miejscowość i data|\(?czytelny podpis|dnia\b|oświadczam|wyrażam zgodę|klauzula|zgodnie z art|art\. \d|"
    r"administrator|rodo|inspektor|przetwarzan|dane osobowe|kontaktować)",
    re.I,
)
TITLE_RE = re.compile(r"^(wniosek|zgłoszenie|deklaracja|oświadczenie)\b", re.I)
OFFICE_RE = re.compile(
    r"\b(urząd (gminy|miasta|miejski|skarbowy)[^,\n]*|wójt[^,\n]*|burmistrz[^,\n]*|prezydent miasta[^,\n]*|starost[ao][^,\n]*)",
    re.I,
)
MULTI_RE = re.compile(r"wiele|wszystkie|więcej niż|co najmniej jedn", re.I)
DATE_RE = re.compile(r"\bdat[aęy]\b|dd-mm|termin\b|okres\b", re.I)
NUMBER_RE = re.compile(r"kwot|liczb|ilość|powierzchni|wysokość opłaty|numer rachunku|nr rachunku|\bm²|\bm2\b", re.I)
AREA_RE = re.compile(r"uzasadnien|opis|uwagi|treść|przyczyn|cel\b", re.I)
FILE_RE = re.compile(r"załączni|w załączeniu|plik|dokument|kopia|odpis|zaświadczen|potwierdzen|dowód uiszczenia", re.I)
VALIDATORS = [
    (re.compile(r"e-?mail|poczty elektronicznej", re.I), Validator.EMAIL),
    (re.compile(r"\bpesel\b", re.I), Validator.PESEL),
    (re.compile(r"\bnip\b", re.I), Validator.NIP),
    (re.compile(r"\bregon\b", re.I), Validator.REGON),
    (re.compile(r"kod pocztowy", re.I), Validator.ZIP_CODE),
    (re.compile(r"epuap", re.I), Validator.EPUAP),
    (re.compile(r"e-?doręcze|\bade\b", re.I), Validator.ADE),
    (re.compile(r"dowodu osobistego", re.I), Validator.SERIAL_NUMBER_ID_CARD),
]
OPTIONAL_RE = re.compile(r"opcjonaln|nieobowiązk|jeżeli dotyczy|jeśli dotyczy", re.I)
ENUM_PREFIX = re.compile(r"^\s*(\d{1,2}[\)\.]|[a-z]\))\s*")


class HeuristicExtractor:
    def extract(self, data: bytes, kind: str, filename: str, settings: Settings) -> FormSpec:
        doc = load(data, kind, tika_url=settings.doc_converter_url)
        return extract_document(doc, filename, settings.with_validators)


def _kind_for(label: str) -> FieldType:
    if FILE_RE.search(label):
        return FieldType.FILE_UPLOADER
    if DATE_RE.search(label):
        return FieldType.DATEPICKER
    if NUMBER_RE.search(label):
        return FieldType.NUMBER
    if AREA_RE.search(label):
        return FieldType.TEXTAREA
    return FieldType.TEXT_FIELD


def _validators(label: str) -> list[Validator]:
    return [v for rx, v in VALIDATORS if rx.search(label)]


def _clean_label(text: str) -> str:
    t = re.sub(r"\s*____\s*", " ", text)
    t = ENUM_PREFIX.sub("", t)
    t = re.sub(r"[\s:.…\-–]+$", "", t).strip()
    t = re.sub(r"\s{2,}", " ", t)
    return t[:120]


def extract_document(doc: Document, filename: str, with_validators: bool = True) -> FormSpec:
    text = doc.to_prompt_text()
    lines = [ln for ln in text.splitlines() if not ln.startswith("===")]
    title = _title(lines) or filename.rsplit(".", 1)[0]
    office = OFFICE_RE.search(text)
    office_name = office.group(0).strip() if office else ""

    pages: list[PageSpec] = []
    section: SectionSpec | None = None
    page = PageSpec(title="Przedmiot wniosku", sections=[])
    pending_label = ""
    pending_options: list[str] = []
    pending_multi = False

    def flush_options() -> None:
        nonlocal pending_options, pending_label, pending_multi
        if section is not None and len(pending_options) >= 2 and pending_label:
            kind = FieldType.CHECKBOX if pending_multi else FieldType.RADIO
            _add(
                section,
                FieldSpec(label=_clean_label(pending_label), kind=kind, options=pending_options, required=True),
                with_validators,
            )
        pending_options, pending_label, pending_multi = [], "", False

    for raw in lines:
        ln = raw.strip()
        if not ln or ln.startswith("[tabela]") or ln.startswith("[/tabela]"):
            continue
        if ln.startswith("## "):
            flush_options()
            head = _clean_label(ln[3:])
            if not head or NOISE_RE.search(head) or (TITLE_RE.search(head) and head.lower() == title.lower()):
                continue
            if re.match(r"^[A-Z]\.\s", head) and section is not None and page.sections:
                pages.append(page)  # new top-level letter section (A., B., ...) -> new page
                page = PageSpec(title=head, sections=[])
            section = SectionSpec(title=head, fields=[])
            page.sections.append(section)
            continue
        if NOISE_RE.search(ln):
            continue
        if section is None:
            section = SectionSpec(title="Dane sprawy", fields=[])
            page.sections.append(section)
        if "☐" in ln:
            opts = [_clean_label(o) for o in ln.split("☐") if _clean_label(o)]
            if not pending_label:
                pending_label = section.title
            pending_options.extend(o for o in opts if o)
            continue
        if "____" in ln:
            flush_options()
            label = _clean_label(ln)
            if len(label) < 3:
                label = _clean_label(pending_label) or section.title
            pending_label = ""
            if is_template_label(label, section.title):
                continue
            dictionary = dictionary_for(label)
            _add(
                section,
                with_proposed(
                    FieldSpec(
                        label=label,
                        kind=FieldType.SELECT if dictionary else _kind_for(label),
                        dictionary=dictionary,
                        required=not OPTIONAL_RE.search(ln),
                        validators=_validators(label),
                    )
                ),
                with_validators,
            )
            continue
        if ln.endswith(":") or ln.endswith("?") or "zaznacz" in ln.lower() or "wybierz" in ln.lower():
            flush_options()
            pending_label = ln
            pending_multi = bool(MULTI_RE.search(ln))
            continue
        if pending_options:
            flush_options()
        pending_label = ln if len(ln) < 80 else ""
    flush_options()
    pages.append(page)
    pages = [p for p in pages if any(s.fields for s in p.sections)]
    for p in pages:
        p.sections = [s for s in p.sections if s.fields]
    if not pages:
        pages = [
            PageSpec(
                title="Przedmiot wniosku",
                sections=[
                    SectionSpec(
                        title="Treść wniosku", fields=[FieldSpec(label="Treść wniosku", kind=FieldType.TEXTAREA)]
                    )
                ],
            )
        ]
    return FormSpec(
        title=title[:255],
        office_name=office_name,
        office_is_organ=bool(re.match(r"wójt|burmistrz|prezydent|starost", office_name, re.I)),
        applicant=applicant_kinds(text, LlmGlobal(title=title)),
        pages=pages,
        with_validators=with_validators,
    )


def _title(lines: list[str]) -> str:
    """'WNIOSEK' + 'o stwierdzenie nadpłaty podatku' on separate heading lines -> one title."""
    for i, ln in enumerate(lines):
        t = ln.lstrip("# ").strip()
        if TITLE_RE.search(t):
            parts = [t]
            for nxt in lines[i + 1 : i + 3]:
                n = nxt.lstrip("# ").strip()
                if (
                    n
                    and not NOISE_RE.search(n)
                    and "____" not in n
                    and (n[:1].islower() or n.lower().startswith("o "))
                    and len(n) < 90
                ):
                    parts.append(n)
                else:
                    break
            title = _clean_label(" ".join(parts))
            if title.isupper():
                title = title.capitalize()
            return re.sub(r"^([A-ZĄĆĘŁŃÓŚŹŻ]{2,})\b", lambda m: m.group(1).capitalize(), title)
    return ""


def _add(section: SectionSpec, field: FieldSpec, with_validators: bool) -> None:
    if any(f.label.lower() == field.label.lower() for f in section.fields):
        return
    if not with_validators:
        field.validators = []
    section.fields.append(field)
