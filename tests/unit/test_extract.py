"""Extractor post-processing (no LLM needed): grounding, template-label dropping, spec assembly."""

import pytest

from formgen.compose import compose
from formgen.compose.dictionaries import proposed_for
from formgen.extract.extractor import to_spec
from formgen.extract.heuristic import extract_document
from formgen.extract.schema import LlmChunk, LlmCondition, LlmField, LlmGlobal, LlmSection, json_schema
from formgen.ingest import Document, Line, Page
from formgen.schema import Severity, check_rules

LINES = {
    1: "## WNIOSEK o stwierdzenie nadpłaty podatku",
    2: "Rodzaj podatku ____",
    3: "Kwota nadpłaty ____",
    4: "Uzasadnienie: ____",
    5: "Imię i nazwisko ____",
    6: "Kwotę nadpłaty proszę:",
    7: "☐ 1) zaliczyć na poczet przyszłego zobowiązania podatkowego z tytułu ____",
    8: "☐ 2) zwrócić przelewem na wskazany rachunek",
    9: "Numer rachunku ____",
    10: "w załączeniu: 1) korekta deklaracji",
    11: "____",
}
SOURCE = "\n".join(LINES.values())


def chunk(lines, *secs):
    return [(s, lines) for s in secs]


def _llm_output():
    g = LlmGlobal(
        title="Wniosek o stwierdzenie nadpłaty podatku",
        office_name="Urząd Gminy Ulan-Majorat",
        applicant_self=True,
        applicant_other_person=True,
        applicant_legal_entity=True,
    )
    secs = chunk(
        LINES,
        LlmSection(
            page_title="Informacje o nadpłacie",
            title="Informacje o nadpłacie",
            fields=[
                LlmField(line=2),
                LlmField(line=3, kind="NUMBER"),
                LlmField(line=4, kind="TEXTAREA"),
                LlmField(line=5),  # template -> dropped
                LlmField(line=42),  # outside the chunk -> dropped
                LlmField(line=11, label="Numer księgi wieczystej"),  # fill-only line -> dropped
            ],
        ),
        LlmSection(
            page_title="Informacje o nadpłacie",
            title="Rozliczenie nadpłaty",
            fields=[
                LlmField(line=6, label="Co zrobić z nadpłatą", kind="RADIO", option_lines=[7, 8]),
                LlmField(line=9, visible_when=LlmCondition(field_line=6, option_line=8)),
            ],
        ),
        LlmSection(
            page_title="Załączniki",
            title="Załączniki",
            fields=[LlmField(line=10, label="Korekta deklaracji", kind="FILE_UPLOADER")],
        ),
    )
    return g, secs


def test_to_spec_resolves_lines_and_drops_template_out_of_range_and_fill_only_lines():
    g, secs = _llm_output()
    spec = to_spec(g, secs, SOURCE, with_validators=True)
    fields = [f for p in spec.pages for s in p.sections for f in s.fields]
    assert [f.label for f in fields] == [
        "Rodzaj podatku",
        "Kwota nadpłaty",
        "Uzasadnienie",
        "Co zrobić z nadpłatą",
        "Numer rachunku",
        "Korekta deklaracji",
    ]
    choice = fields[3]
    assert choice.options == [
        "Zaliczyć na poczet przyszłego zobowiązania podatkowego z tytułu",
        "Zwrócić przelewem na wskazany rachunek",
    ]
    assert [(c.field, c.value) for c in fields[4].visible_when] == [
        ("Co zrobić z nadpłatą", "Zwrócić przelewem na wskazany rachunek")
    ]
    assert [p.title for p in spec.pages] == ["Informacje o nadpłacie", "Załączniki"]


def test_ungrounded_label_override_falls_back_to_line_text():
    lines = {1: "3. Powierzchnia działki (m2): ____"}
    secs = chunk(
        lines, LlmSection(page_title="P", title="S", fields=[LlmField(line=1, label="Numer księgi wieczystej")])
    )
    spec = to_spec(LlmGlobal(title="x"), secs, lines[1], with_validators=True)
    assert spec.pages[0].sections[0].fields[0].label == "Powierzchnia działki (m2)"


@pytest.mark.parametrize(
    ("line", "text"),
    [
        ("## B.2 DANE NIERUCHOMOŚCI", "DANE NIERUCHOMOŚCI"),
        ("☐ 1) zaliczyć na poczet ____", "Zaliczyć na poczet"),
        ("a. Rodzaj podatku:", "Rodzaj podatku"),
        ("2.1) teren", "Teren"),
        ("Kwota | ____ |", "Kwota"),
        ("W przypadku zwrotu", "W przypadku zwrotu"),
        ("____ ☐", ""),
        ("2) ____", ""),
    ],
)
def test_clean_strips_markup_from_source_lines(line, text):
    from formgen.extract.extractor import clean

    assert clean(line) == text


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
    lines = {1: "Rodzaj podatku ____", 2: "Rodzaj podatku:", 3: "w załączeniu: 1) korekta deklaracji"}
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="S",
            fields=[LlmField(line=1), LlmField(line=2), LlmField(line=3, label="Załączniki", kind="CHECKBOX")],
        ),
    )
    spec = to_spec(g, secs, "\n".join(lines.values()), with_validators=True)
    fields = spec.pages[0].sections[0].fields
    assert [f.label for f in fields] == ["Rodzaj podatku", "Załączniki"]
    assert fields[1].kind == "FILE_UPLOADER"


def test_address_labels_kept_in_subject_sections_but_dropped_for_applicant():
    from formgen.extract.extractor import is_template_label

    assert not is_template_label("Miejscowość", "Lokalizacja budynku")
    assert is_template_label("Miejscowość", "Dane wnioskodawcy")
    assert is_template_label("Numer PESEL", "Lokalizacja budynku")
    # 01 pdf: the model merged the applicant and the building location into one section
    assert not is_template_label("Miejscowość", "Dane wnioskodawcy i adres nieruchomości")
    assert not is_template_label("Ulica", "Dane wnioskodawcy i adres nieruchomości")
    assert is_template_label("Imię i nazwisko", "Dane wnioskodawcy i adres nieruchomości")


def test_attachment_radio_becomes_file_uploaders_and_sections_merge():
    g = LlmGlobal(title="x")
    lines = {
        1: "Wybierz załącznik:",
        2: "1) korekta deklaracji",
        3: "2) ____",
        4: "Kwota ____",
        5: "Numer rachunku ____",
    }
    secs = chunk(
        lines,
        LlmSection(page_title="P", title="Załączniki", fields=[LlmField(line=1, kind="RADIO", option_lines=[2, 3])]),
        LlmSection(page_title="P", title="Rozliczenie", fields=[LlmField(line=4, kind="NUMBER")]),
        LlmSection(page_title="P", title="Rozliczenie", fields=[LlmField(line=4, kind="NUMBER"), LlmField(line=5)]),
    )
    spec = to_spec(g, secs, "\n".join(lines.values()), with_validators=True)
    secs_out = spec.pages[0].sections
    assert [s.title for s in secs_out] == ["Załączniki", "Rozliczenie"]
    assert [(f.label, f.kind) for f in secs_out[0].fields] == [("Korekta deklaracji", "FILE_UPLOADER")]
    assert [f.label for f in secs_out[1].fields] == ["Kwota", "Numer rachunku"]


def test_consent_sections_go_to_contact_page_and_choice_labels_stay_radio():
    g = LlmGlobal(title="x")
    lines = {1: "☐ Zgoda na warunki wynajmu", 2: "Rodzaj zaświadczenia:", 3: "☐ o dochodach", 4: "☐ o niezaleganiu"}
    secs = chunk(
        lines,
        LlmSection(page_title="P", title="Zgody i oświadczenia", fields=[LlmField(line=1)]),
        LlmSection(page_title="P", title="Rodzaj", fields=[LlmField(line=2, kind="RADIO", option_lines=[3, 4])]),
    )
    spec = to_spec(g, secs, "\n".join(lines.values()), with_validators=True)
    assert spec.extra_consents == [("Zgoda na warunki wynajmu", True)]
    f = spec.pages[0].sections[0].fields[0]
    assert f.kind == "RADIO" and f.options == ["O dochodach", "O niezaleganiu"]


def test_noise_sections_empty_labels_dropped_and_pages_capped():
    from formgen.extract.extractor import MAX_SUBJECT_PAGES

    g = LlmGlobal(title="x")
    lines = {i + 1: f"Pole {i} ____" for i in range(9)} | {10: " "}
    secs = [LlmSection(page_title=f"Strona {i}", title=f"Sekcja {i}", fields=[LlmField(line=i + 1)]) for i in range(9)]
    secs.append(LlmSection(page_title="Wyjaśnienia", title="Objaśnienia", fields=[LlmField(line=2)]))
    secs.append(LlmSection(page_title="Strona 0", title="Sekcja 0", fields=[LlmField(line=10), LlmField(line=2)]))
    spec = to_spec(g, chunk(lines, *secs), "\n".join(lines.values()), with_validators=True)
    assert len(spec.pages) == MAX_SUBJECT_PAGES
    assert sum(len(s.fields) for p in spec.pages for s in p.sections) == 10  # 9 + 'Pole 1' merged into Sekcja 0
    assert not any(s.title == "Objaśnienia" for p in spec.pages for s in p.sections)


def test_invalid_chunk_is_split_then_skipped_not_fatal():
    from formgen.config import Settings
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
            return LlmChunk(sections=[LlmSection(page_title="P", title="S", fields=[LlmField(line=1)])])

    lines = [Line("Pole A ____", top=i) for i in range(40)] + [Line("DRUGA część ____", top=100)] * 60
    doc = Document(pages=[Page(number=1, lines=lines)])
    client = FakeClient()
    spec = LlmExtractor(client).extract_document(doc, "x.pdf", Settings(_env_file=None))
    assert spec.title == "Wniosek testowy"
    assert client.calls.count("LlmChunk") >= 2  # retried on halves
    assert spec.pages and spec.pages[0].sections[0].fields[0].label == "Pole A"


def test_chunk_answer_budget_fills_free_context_and_oversize_prompt_is_split_before_the_call():
    from formgen.config import Settings
    from formgen.extract.extractor import CHARS_PER_TOKEN, LlmExtractor
    from formgen.ingest.model import Document, Line, Page

    class FakeClient:
        def __init__(self):
            self.chunks = []

        def complete(self, system, user, out, max_tokens=2048):
            if out is LlmGlobal:
                return LlmGlobal(title="Wniosek testowy")
            self.chunks.append((len(system) + len(user), max_tokens))
            return LlmChunk(sections=[])

    ctx = 8192
    settings = Settings(_env_file=None, llm_context_tokens=ctx)
    small = Document(pages=[Page(number=1, lines=[Line("Pole A ____", top=0)])])
    client = FakeClient()
    LlmExtractor(client).extract_document(small, "x.pdf", settings)
    [(chars, budget)] = client.chunks
    assert budget > 2048  # a short prompt leaves most of the slot to the answer
    assert chars / CHARS_PER_TOKEN + budget <= ctx

    # one sheet page of ~16k chars (form 08 xlsx) does not fit with any answer: split first, never truncate
    big = Document(pages=[Page(number=1, lines=[Line(f"Pozycja {i} ____ ☐ tak ☐ nie", top=i) for i in range(600)])])
    client = FakeClient()
    LlmExtractor(client).extract_document(big, "x.xlsx", settings)
    assert len(client.chunks) >= 2
    assert all(chars / CHARS_PER_TOKEN + budget <= ctx for chars, budget in client.chunks)


def test_yes_no_attachment_radio_stays_radio_and_dash_labels_dropped():
    g = LlmGlobal(title="x")
    lines = {1: "Załącznik A", 2: "☐ TAK", 3: "☐ NIE", 4: "____", 5: "-"}
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="Załączniki",
            fields=[LlmField(line=1, kind="RADIO", option_lines=[2, 3]), LlmField(line=4), LlmField(line=5)],
        ),
    )
    spec = to_spec(g, secs, "\n".join(lines.values()), with_validators=True)
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
    lines = {1: "Miejscowość ____", 2: "Gmina ____"}
    secs = chunk(
        lines, LlmSection(page_title="P", title="Lokalizacja budynku", fields=[LlmField(line=1), LlmField(line=2)])
    )
    spec = to_spec(g, secs, "Miejscowość ____ Gmina ____", with_validators=True)
    fields = spec.pages[0].sections[0].fields
    assert [(f.kind, f.dictionary) for f in fields] == [("SELECT", "Miejscowość"), ("SELECT", "Gmina")]


@pytest.mark.parametrize(
    ("label", "name"),
    [
        ("Dyscyplina sportowa", "Dyscypliny sportowe"),
        ("Dyscypliny sportowe:", "Dyscypliny sportowe"),
        ("Rasa psa", "Rasy psów wymagające zezwolenia"),
        ("Rasy psów", "Rasy psów wymagające zezwolenia"),
        ("Rodzaj podatku", "Rodzaje podatków i opłat lokalnych"),
        ("Nazwa podatku", "Rodzaje podatków i opłat lokalnych"),
        ("Podatek, którego dotyczy nadpłata", "Rodzaje podatków i opłat lokalnych"),
        ("Z tytułu podatku", "Rodzaje podatków i opłat lokalnych"),
        ("Rodzaj wniosku", None),
        ("Kwota nadpłaty", None),
        ("Rasa", None),
        ("Województwo", None),
        ("Powiat", None),
        ("Gmina", None),
        ("Miejscowość", None),
        ("Kraj", None),
        ("Ulica", None),
        ("Kod pocztowy", None),
    ],
)
def test_proposed_dictionary_for_label(label, name):
    proposed = proposed_for(label)
    assert (proposed.name if proposed else None) == name


BREEDS = [
    "amerykański pit bull terrier",
    "pies z Majorki (Perro de Presa Mallorquin)",
    "buldog amerykański",
    "dog argentyński",
    "pies kanaryjski (Perro de Presa Canario)",
    "tosa inu",
    "rottweiler",
    "akbash dog",
    "anatolian karabash",
    "moskiewski stróżujący",
    "owczarek kaukaski",
    "chart rasowy",
    "mieszaniec charta",
]


def test_llm_field_matching_proposed_dictionary_gets_its_options_and_passes_rules():
    g = LlmGlobal(title="Wniosek o zezwolenie na utrzymywanie psa")
    lines = {1: "Rasa psa ____", 2: "Rodzaj podatku", 3: "☐ podatek rolny", 4: "☐ podatek leśny"}
    secs = chunk(
        lines,
        LlmSection(
            page_title="Dane psa",
            title="Dane psa",
            fields=[LlmField(line=1, kind="TEXT_FIELD"), LlmField(line=2, kind="RADIO", option_lines=[3, 4])],
        ),
    )
    spec = to_spec(g, secs, "Rasa psa ____ Rodzaj podatku ☐ podatek rolny ☐ podatek leśny", with_validators=True)
    rasa, podatek = spec.pages[0].sections[0].fields
    assert (rasa.kind, rasa.options, rasa.dictionary) == ("SELECT", BREEDS, None)
    assert (podatek.kind, podatek.options) == ("RADIO", ["Podatek rolny", "Podatek leśny"])
    form = compose(spec)
    assert not [v for v in check_rules(form) if v.severity == Severity.ERROR]
    out = next(f for _, f in form.iter_fields() if f.title == "Rasa psa")
    assert [o.name for o in out.options] == BREEDS and out.dictionaryName is None
    assert out.tooltipMessage == "Proponowany słownik: Rasy psów wymagające zezwolenia"


def test_heuristic_dotted_line_matching_proposed_dictionary_gets_its_options():
    doc = Document(pages=[Page(number=1, lines=[Line("Dane psa", bold=True), Line("Rasa psa: ..........")])])
    spec = extract_document(doc, "wniosek.pdf")
    rasa = next(f for p in spec.pages for s in p.sections for f in s.fields if f.label == "Rasa psa")
    assert (rasa.kind, rasa.options) == ("SELECT", BREEDS)
    assert not [v for v in check_rules(compose(spec)) if v.severity == Severity.ERROR]


def test_section_prompt_has_cacheable_prefix():
    """On CPU llama.cpp reuses the KV cache only for an identical prefix: chunk-specific text must come last."""
    from formgen.extract.prompts import SECTIONS_USER

    a = SECTIONS_USER.format(pages="strony 1-2", text="AAA")
    b = SECTIONS_USER.format(pages="strony 3-4", text="BBB")
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    assert i > len(a) - 60, "chunk-specific content must sit at the very end of the prompt"


def test_text_block_on_a_fill_line_becomes_an_input_and_a_real_block_keeps_its_text():
    # 01 pdf: the model marked every location field TEXT_BLOCK; a field with '____' or '☐' is never a block
    lines = {
        1: "w miejscowości ____ przy ulicy ____",
        2: "Wnoszę o ustalenie numeru porządkowego budynkowi",
        3: "Rodzaj budynku:",
        4: "☐ mieszkalny",
        5: "☐ gospodarczy",
        6: "(podpis wnioskodawcy) 2)",
    }
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="Lokalizacja budynku",
            fields=[
                LlmField(line=1, label="Miejscowość", kind="TEXT_BLOCK"),
                LlmField(line=2, kind="TEXT_BLOCK"),
                LlmField(line=3, kind="TEXT_BLOCK", option_lines=[4, 5]),
                LlmField(line=6, label="Obręb", kind="TEXT_BLOCK"),  # a caption under a fill line -> dropped
            ],
        ),
    )
    spec = to_spec(LlmGlobal(title="x"), secs, "\n".join(lines.values()), with_validators=True)
    fields = spec.pages[0].sections[0].fields
    assert [(f.label, f.kind) for f in fields] == [
        ("Miejscowość", "SELECT"),  # TEXT_FIELD, then the Miejscowość dictionary
        ("Wnoszę o ustalenie numeru porządkowego budynkowi", "TEXT_BLOCK"),
        ("Rodzaj budynku", "RADIO"),  # its option lines have boxes
    ]
    assert fields[1].description == "Wnoszę o ustalenie numeru porządkowego budynkowi"


def test_second_field_with_the_same_proposed_dictionary_and_visibility_in_a_section_is_dropped():
    # 05 pdf: the tax list attached to three lines, each label naming "podatku"; the conditional one stays
    lines = {
        1: "wnoszę o stwierdzenie nadpłaty z tytułu ____",
        2: "(rodzaj podatku)",
        3: "Miejscowość ____",
        4: "Miejscowość urodzenia ____",
        5: "Kwotę nadpłaty proszę:",
        6: "☐ 1) zaliczyć na poczet zobowiązania z tytułu ____",
        7: "☐ 2) zwrócić przelewem na wskazany rachunek",
    }
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="Informacje o nadpłacie",
            fields=[
                LlmField(line=1, label="Tytuł podatku"),
                LlmField(line=2, label="Rodzaj podatku"),
                LlmField(line=3),
                LlmField(line=4),
                LlmField(line=5, label="Co zrobić z nadpłatą", kind="RADIO", option_lines=[6, 7]),
                LlmField(line=6, label="Nazwa podatku", visible_when=LlmCondition(field_line=5, option_line=6)),
            ],
        ),
    )
    spec = to_spec(LlmGlobal(title="x"), secs, "\n".join(lines.values()), with_validators=True)
    fields = spec.pages[0].sections[0].fields
    # predefined dictionaries may repeat: place of residence and place of birth are two fields
    assert [(f.label, f.kind) for f in fields] == [
        ("Tytuł podatku", "SELECT"),
        ("Miejscowość", "SELECT"),
        ("Miejscowość urodzenia", "SELECT"),
        ("Co zrobić z nadpłatą", "RADIO"),
        ("Nazwa podatku", "SELECT"),
    ]


def test_a_line_with_a_printed_address_is_filled_data_not_a_field():
    # 01 pdf: the office address sits on the applicant's fill lines ("## ____ ____ ul. Browarna 85")
    lines = {1: "## ____ ____ ul. Browarna 85", 2: "## ____ . 82-300 Elbląg", 3: "Ulica ____"}
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="Adres nieruchomości",
            fields=[LlmField(line=1), LlmField(line=2, label="Kod pocztowy i miejscowość"), LlmField(line=3)],
        ),
    )
    spec = to_spec(LlmGlobal(title="x"), secs, "\n".join(lines.values()), with_validators=True)
    assert [f.label for f in spec.pages[0].sections[0].fields] == ["Ulica"]


def test_office_address_section_is_noise():
    # 05 png: the model gave the addressee (Urząd Gminy, its street, postal code) its own section
    from formgen.extract.extractor import NOISE_SECTION_RE

    assert NOISE_SECTION_RE.search("Dane urzędowe")
    assert NOISE_SECTION_RE.search("Dane urzędu")
    assert NOISE_SECTION_RE.search("Adresat wniosku")
    assert not NOISE_SECTION_RE.search("Lokalizacja budynku")


def test_two_fields_on_one_line_keep_their_own_labels():
    lines = {1: "w miejscowości ____ przy ulicy ____", 2: "nr ewidencyjny działki ____ w obrębie ____"}
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="Lokalizacja budynku",
            fields=[
                LlmField(line=1, label="Miejscowość"),
                LlmField(line=1, label="Ulica"),
                LlmField(line=2, label="Numer ewidencyjny działki"),
                LlmField(line=2, label="Obręb"),
            ],
        ),
    )
    spec = to_spec(LlmGlobal(title="x"), secs, "\n".join(lines.values()), with_validators=True)
    labels = [f.label for f in spec.pages[0].sections[0].fields]
    assert labels == ["Miejscowość", "Ulica", "Numer ewidencyjny działki", "Obręb"]


def test_fill_only_line_next_to_the_override_text_keeps_the_field():
    lines = {1: "nr ewidencyjny działki", 2: "____", 3: "(podpis)", 4: "____"}
    secs = chunk(
        lines,
        LlmSection(
            page_title="P",
            title="Lokalizacja budynku",
            fields=[
                LlmField(line=2, label="Nr ewidencyjny działki"),
                LlmField(line=4, label="Numer księgi wieczystej"),
            ],
        ),
    )
    spec = to_spec(LlmGlobal(title="x"), secs, "\n".join(lines.values()), with_validators=True)
    assert [f.label for f in spec.pages[0].sections[0].fields] == ["Nr ewidencyjny działki"]


def test_collapsed_chunk_answer_is_retried_on_halves():
    # 09 pdf: on chunks with 50-70 fill/box lines the model answered one field and stopped
    from formgen.config import Settings
    from formgen.extract.extractor import LlmExtractor
    from formgen.ingest.model import Document, Line, Page

    class FakeClient:
        def __init__(self):
            self.chunk_calls = 0

        def complete(self, system, user, out, max_tokens=2048):
            if out is LlmGlobal:
                return LlmGlobal(title="Wniosek testowy")
            self.chunk_calls += 1
            if self.chunk_calls == 1:  # the whole chunk: one field
                return LlmChunk(sections=[LlmSection(page_title="P", title="S", fields=[LlmField(line=1)])])
            first = int(user.split("\n[", 1)[1].split("]", 1)[0])  # first line number in this half
            return LlmChunk(
                sections=[
                    LlmSection(page_title="P", title="S", fields=[LlmField(line=first), LlmField(line=first + 1)])
                ]
            )

    lines = [Line(f"Pole numer {i} ____", top=i) for i in range(60)]
    doc = Document(pages=[Page(number=1, lines=lines)])
    client = FakeClient()
    spec = LlmExtractor(client).extract_document(doc, "x.pdf", Settings(_env_file=None))
    assert client.chunk_calls == 3  # whole chunk, then its two halves (each answers 2 fields: no further split)
    assert len(spec.pages[0].sections[0].fields) == 4
