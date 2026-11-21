"""Extractor post-processing (no LLM needed): grounding, template-label dropping, spec assembly."""

from formgen.compose import compose
from formgen.extract.extractor import to_spec
from formgen.extract.schema import LlmChunk, LlmCondition, LlmField, LlmGlobal, LlmSection, json_schema
from formgen.schema import Severity, check_rules

SOURCE = """## WNIOSEK o stwierdzenie nadpłaty podatku
wnoszę o stwierdzenie nadpłaty z tytułu ____ w kwocie ____ (rodzaj podatku)
Uzasadnienie: ____
Kwotę nadpłaty proszę: 1) zaliczyć na poczet przyszłego zobowiązania podatkowego z tytułu ____ 2) zwrócić przelewem na wskazany rachunek
w załączeniu: 1) korekta deklaracji"""


def _llm_output():
    g = LlmGlobal(
        title="Wniosek o stwierdzenie nadpłaty podatku",
        office_name="Urząd Gminy Ulan-Majorat",
        applicant_self=True,
        applicant_other_person=True,
        applicant_legal_entity=True,
    )
    secs = [
        LlmSection(
            page_title="Informacje o nadpłacie",
            title="Informacje o nadpłacie",
            fields=[
                LlmField(label="Rodzaj podatku"),
                LlmField(label="Kwota nadpłaty", kind="NUMBER"),
                LlmField(label="Uzasadnienie", kind="TEXTAREA"),
                LlmField(label="Imię i nazwisko"),  # template -> dropped
                LlmField(label="Numer księgi wieczystej"),  # hallucinated -> dropped
            ],
        ),
        LlmSection(
            page_title="Informacje o nadpłacie",
            title="Rozliczenie nadpłaty",
            fields=[
                LlmField(
                    label="Co zrobić z nadpłatą",
                    kind="RADIO",
                    options=[
                        "Zaliczyć na poczet przyszłego zobowiązania podatkowego",
                        "Zwrócić przelewem na wskazany rachunek",
                    ],
                ),
                LlmField(
                    label="Numer rachunku",
                    visible_when=LlmCondition(
                        field_label="Co zrobić z nadpłatą", equals="Zwrócić przelewem na wskazany rachunek"
                    ),
                ),
            ],
        ),
        LlmSection(
            page_title="Załączniki",
            title="Załączniki",
            fields=[LlmField(label="Korekta deklaracji", kind="FILE_UPLOADER")],
        ),
    ]
    return g, secs


def test_to_spec_drops_template_and_ungrounded_fields():
    g, secs = _llm_output()
    spec = to_spec(g, secs, SOURCE, with_validators=True)
    labels = [f.label for p in spec.pages for s in p.sections for f in s.fields]
    assert "Imię i nazwisko" not in labels
    assert "Numer księgi wieczystej" not in labels
    assert "Rodzaj podatku" in labels and "Korekta deklaracji" in labels
    assert [p.title for p in spec.pages] == ["Informacje o nadpłacie", "Załączniki"]
    assert spec.applicant.legal_entity and spec.applicant.other_person


def test_to_spec_composes_valid_form_with_dependency():
    g, secs = _llm_output()
    form = compose(to_spec(g, secs, SOURCE, with_validators=True))
    assert not [v for v in check_rules(form) if v.severity == Severity.ERROR]
    numer = next(f for _, f in form.iter_fields() if f.title == "Numer rachunku")
    assert numer.states and "Zwrócić przelewem" in numer.states[0].query
    assert [t.title for t in form.tabs] == [
        "Dane",
        "Informacje o nadpłacie",
        "Załączniki",
        "Kontakt i zgody",
        "Strona końcowa",
    ]


def test_llm_json_schema_keeps_property_named_title():
    s = json_schema(LlmGlobal)
    assert "title" in s["properties"] and "title" in s["required"]


def test_llm_json_schema_is_ref_free():
    s = json_schema(LlmChunk)
    assert "$ref" not in str(s) and "$defs" not in s
    assert s["properties"]["sections"]["items"]["properties"]["fields"]["items"]["properties"]["kind"]["enum"]


def test_applicant_kinds_from_text():
    from formgen.extract.extractor import applicant_kinds

    both = applicant_kinds(
        "Nazwisko i imię/Nazwa firmy ____ PESEL ____ NIP ____ podpis wnioskodawcy lub osoby upoważnionej"
    )
    assert (both.self_person, both.other_person, both.legal_entity) == (True, True, True)
    person = applicant_kinds("Imię ____ Nazwisko ____ PESEL ____")
    assert (person.self_person, person.other_person, person.legal_entity) == (True, False, False)
    firm = applicant_kinds("Nazwa firmy ____ NIP ____ REGON ____ adres siedziby ____")
    assert (firm.self_person, firm.other_person, firm.legal_entity) == (False, False, True)


def test_numbered_variants_after_colon_become_choices():
    from formgen.ingest.model import Document, Line, Page

    doc = Document(
        pages=[
            Page(
                number=1,
                lines=[
                    Line("Kwotę nadpłaty proszę:", top=1),
                    Line("1) zaliczyć na poczet", top=2),
                    Line("2) zwrócić przelewem", top=3),
                    Line("Pouczenie", top=4),
                    Line("1) instrukcja", top=5),
                ],
            )
        ]
    )
    t = doc.to_prompt_text()
    assert "☐ 1) zaliczyć" in t and "☐ 2) zwrócić" in t and "☐ 1) instrukcja" not in t


def test_to_spec_applicant_from_text_overrides_llm():
    g = LlmGlobal(title="x", applicant_self=False, applicant_other_person=False, applicant_legal_entity=True)
    spec = to_spec(g, [], "Nazwisko i imię/Nazwa firmy PESEL NIP osoby upoważnionej", with_validators=True)
    assert spec.applicant.self_person and spec.applicant.other_person and spec.applicant.legal_entity


def test_to_spec_dedupes_labels_and_fixes_optionless_choice():
    g = LlmGlobal(title="x")
    secs = [
        LlmSection(
            page_title="P",
            title="S",
            fields=[
                LlmField(label="Rodzaj podatku"),
                LlmField(label="Rodzaj podatku"),
                LlmField(label="Załączniki", kind="CHECKBOX"),
            ],
        )
    ]
    spec = to_spec(g, secs, "Rodzaj podatku ____ w załączeniu: 1) korekta deklaracji", with_validators=True)
    fields = spec.pages[0].sections[0].fields
    assert [f.label for f in fields] == ["Rodzaj podatku", "Załączniki"]
    assert fields[1].kind == "FILE_UPLOADER"


def test_address_labels_kept_in_subject_sections_but_dropped_for_applicant():
    from formgen.extract.extractor import is_template_label

    assert not is_template_label("Miejscowość", "Lokalizacja budynku")
    assert is_template_label("Miejscowość", "Dane wnioskodawcy")
    assert is_template_label("Numer PESEL", "Lokalizacja budynku")


def test_attachment_radio_becomes_file_uploaders_and_sections_merge():
    g = LlmGlobal(title="x")
    secs = [
        LlmSection(
            page_title="P",
            title="Załączniki",
            fields=[LlmField(label="Wybierz załącznik", kind="RADIO", options=["Korekta deklaracji", "____"])],
        ),
        LlmSection(page_title="P", title="Rozliczenie", fields=[LlmField(label="Kwota", kind="NUMBER")]),
        LlmSection(
            page_title="P",
            title="Rozliczenie",
            fields=[LlmField(label="Kwota", kind="NUMBER"), LlmField(label="Numer rachunku")],
        ),
    ]
    spec = to_spec(g, secs, "w załączeniu: korekta deklaracji; Kwota ____; Numer rachunku ____", with_validators=True)
    secs_out = spec.pages[0].sections
    assert [s.title for s in secs_out] == ["Załączniki", "Rozliczenie"]
    assert [(f.label, f.kind) for f in secs_out[0].fields] == [("Korekta deklaracji", "FILE_UPLOADER")]
    assert [f.label for f in secs_out[1].fields] == ["Kwota", "Numer rachunku"]


def test_consent_sections_go_to_contact_page_and_choice_labels_stay_radio():
    g = LlmGlobal(title="x")
    secs = [
        LlmSection(page_title="P", title="Zgody i oświadczenia", fields=[LlmField(label="Zgoda na warunki wynajmu")]),
        LlmSection(
            page_title="P",
            title="Rodzaj",
            fields=[LlmField(label="Rodzaj zaświadczenia", kind="RADIO", options=["o dochodach", "o niezaleganiu"])],
        ),
    ]
    spec = to_spec(
        g, secs, "Zgoda na warunki wynajmu; Rodzaj zaświadczenia: o dochodach, o niezaleganiu", with_validators=True
    )
    assert spec.extra_consents == [("Zgoda na warunki wynajmu", True)]
    f = spec.pages[0].sections[0].fields[0]
    assert f.kind == "RADIO" and len(f.options) == 2


def test_noise_sections_empty_labels_dropped_and_pages_capped():
    from formgen.extract.extractor import MAX_SUBJECT_PAGES

    g = LlmGlobal(title="x")
    secs = [
        LlmSection(page_title=f"Strona {i}", title=f"Sekcja {i}", fields=[LlmField(label=f"Pole {i}")])
        for i in range(9)
    ]
    secs.append(LlmSection(page_title="Wyjaśnienia", title="Objaśnienia", fields=[LlmField(label="Pole 1")]))
    secs.append(
        LlmSection(page_title="Strona 0", title="Sekcja 0", fields=[LlmField(label=" "), LlmField(label="Pole 1")])
    )
    src = " ".join(f"Pole {i} ____" for i in range(9))
    spec = to_spec(g, secs, src, with_validators=True)
    assert len(spec.pages) == MAX_SUBJECT_PAGES
    assert sum(len(s.fields) for p in spec.pages for s in p.sections) == 10  # 9 + 'Pole 1' merged into Sekcja 0
    assert not any(s.title == "Objaśnienia" for p in spec.pages for s in p.sections)


def test_invalid_chunk_is_split_then_skipped_not_fatal():
    from formgen.api.settings import Settings
    from formgen.extract.extractor import LlmExtractor
    from formgen.ingest.model import Document, Line, Page

    class FakeClient:
        def __init__(self):
            self.calls = []

        def complete(self, system, user, out, max_tokens=2048):
            self.calls.append(out.__name__)
            if out is LlmGlobal:
                return LlmGlobal(title="Wniosek testowy")
            if "DRUGA" in user and len(self.calls) < 4:
                raise ValueError("LLM returned invalid LlmChunk: truncated")
            return LlmChunk(sections=[LlmSection(page_title="P", title="S", fields=[LlmField(label="Pole A")])])

    lines = [Line("Pole A ____", top=i) for i in range(40)] + [Line("DRUGA część ____", top=100)] * 60
    doc = Document(pages=[Page(number=1, lines=lines)])
    client = FakeClient()
    spec = LlmExtractor(client).extract_document(doc, "x.pdf", Settings(_env_file=None))
    assert spec.title == "Wniosek testowy"
    assert client.calls.count("LlmChunk") >= 2  # retried on halves
    assert spec.pages and spec.pages[0].sections[0].fields[0].label == "Pole A"


def test_yes_no_attachment_radio_stays_radio_and_dash_labels_dropped():
    g = LlmGlobal(title="x")
    secs = [
        LlmSection(
            page_title="P",
            title="Załączniki",
            fields=[
                LlmField(label="Załącznik A", kind="RADIO", options=["TAK", "NIE"]),
                LlmField(label="____"),
                LlmField(label="-"),
            ],
        )
    ]
    spec = to_spec(g, secs, "Załącznik A TAK NIE", with_validators=True)
    fields = spec.pages[0].sections[0].fields
    assert [(f.label, f.kind) for f in fields] == [("Załącznik A", "RADIO")]


def test_llm_address_like_labels_get_dictionaries():
    from formgen.compose.dictionaries import dictionary_for

    assert dictionary_for("Kraj urodzenia") == "Kraje"
    assert dictionary_for("Obywatelstwo") == "Kraje"
    assert dictionary_for("Województwo") == "Województwo"
    assert dictionary_for("Gmina") == "Gmina"
    assert dictionary_for("Miejscowość") == "Miejscowość"
    assert dictionary_for("Numer kierunkowy") == "Numery kierunkowe"
    assert dictionary_for("Rodzaj podatku") is None
    g = LlmGlobal(title="x")
    secs = [
        LlmSection(
            page_title="P", title="Lokalizacja budynku", fields=[LlmField(label="Miejscowość"), LlmField(label="Gmina")]
        )
    ]
    spec = to_spec(g, secs, "Miejscowość ____ Gmina ____", with_validators=True)
    fields = spec.pages[0].sections[0].fields
    assert [(f.kind, f.dictionary) for f in fields] == [("SELECT", "Miejscowość"), ("SELECT", "Gmina")]
