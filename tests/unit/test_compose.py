"""The deterministic composer must reproduce the template pages of the golden files."""

import json

import pytest

from formgen.compose import ApplicantKinds, FieldSpec, FormSpec, PageSpec, SectionSpec, compose
from formgen.compose import jsonata as jq
from formgen.compose.builders import show
from formgen.compose.spec import Condition
from formgen.eval.metric import compare
from formgen.schema import FieldType, FormDefinition, Severity, check_rules
from tests.conftest import GOLDEN_DIR


def _golden(name: str) -> FormDefinition:
    return FormDefinition.from_json_dict(json.loads((GOLDEN_DIR / f"{name}.json").read_text(encoding="utf-8")))


SPEC_05 = FormSpec(
    title="Wniosek o stwierdzenie nadpłaty podatku",
    office_name="Urząd Gminy Ulan-Majorat",
    applicant=ApplicantKinds(self_person=True, other_person=True, legal_entity=True),
    identity_source="PESEL",
    include_pesel=True,
    pages=[
        PageSpec(
            title="Informacje o nadpłacie",
            sections=[
                SectionSpec(
                    title="Informacje o nadpłacie",
                    fields=[
                        FieldSpec(label="Podatek, którego dotyczy nadpłata"),
                        FieldSpec(label="Kwota", kind=FieldType.NUMBER),
                        FieldSpec(
                            label="Uzasadnienie",
                            kind=FieldType.TEXTAREA,
                            description="Uzasadnij dlaczego Twoim zdaniem powstała nadpłata i z czego wynika jej wysokość.",
                        ),
                    ],
                ),
                SectionSpec(
                    title="Rozliczenie nadpłaty",
                    fields=[
                        FieldSpec(
                            label="Wybierz, co mamy zrobić z nadpłatą",
                            kind=FieldType.RADIO,
                            options=[
                                "Zaliczyć na poczet przyszłego zobowiązania podatkowego",
                                "Zwrócić przelewem na rachunek bankowy",
                            ],
                        ),
                        FieldSpec(
                            label="Nazwa podatku",
                            visible_when=[
                                Condition(
                                    field="wybierz_co_mamy_zrobic_z_nadplata",
                                    value="Zaliczyć na poczet przyszłego zobowiązania podatkowego",
                                )
                            ],
                        ),
                        FieldSpec(
                            label="Numer rachunku",
                            visible_when=[
                                Condition(
                                    field="wybierz_co_mamy_zrobic_z_nadplata",
                                    value="Zwrócić przelewem na rachunek bankowy",
                                )
                            ],
                        ),
                    ],
                ),
                SectionSpec(
                    title="Korekta deklaracji",
                    description="Załącz poprawioną deklarację podatkową, z której wynika prawidłowa, niższa wysokość zobowiązania podatkowego, a w konsekwencji nadpłata.",
                    fields=[FieldSpec(label="Plik deklaracji podatkowej", kind=FieldType.FILE_UPLOADER)],
                ),
            ],
        )
    ],
)

SPEC_01 = FormSpec(
    title="Wniosek o ustalenie numeru porządkowego nieruchomości",
    office_name="Wójt Gminy Elbląg",
    office_is_organ=True,
    applicant=ApplicantKinds(self_person=True, other_person=True, legal_entity=True),
    identity_source="MLPZ",
    include_pesel=False,
    contact_page_title="Kontakt z urzędem",
    pages=[
        PageSpec(
            title="Informacje o budynku",
            sections=[
                SectionSpec(
                    title="Lokalizacja budynku",
                    fields=[
                        FieldSpec(label="Miejscowość"),
                        FieldSpec(label="Ulica", tech_name="ulica_budynku"),
                        FieldSpec(label="Numer ewidencyjny działki"),
                        FieldSpec(label="Obręb", tech_name="obreb_numer"),
                    ],
                )
            ],
        )
    ],
)


@pytest.mark.parametrize(
    "spec,name", [(SPEC_05, "05_nadplata_podatku"), (SPEC_01, "01_numer_porzadkowy_nieruchomosci")]
)
def test_compose_passes_rules(spec, name):
    form = compose(spec)
    errors = [v for v in check_rules(form) if v.severity == Severity.ERROR]
    assert errors == [], "\n".join(map(str, errors))


@pytest.mark.parametrize(
    "spec,name", [(SPEC_05, "05_nadplata_podatku"), (SPEC_01, "01_numer_porzadkowy_nieruchomosci")]
)
def test_compose_matches_golden(spec, name):
    form, golden = compose(spec), _golden(name)
    r = compare(form, golden)
    print(name, r.summary(), "\nmissing:", r.unmatched_golden, "\nextra:", r.unmatched_ours)
    assert r.recall >= 0.95, r.unmatched_golden
    assert r.type_acc >= 0.95
    assert r.show_recall >= 0.9
    assert [t.title for t in form.tabs] == [t.title for t in golden.tabs]
    assert [t.type for t in form.tabs] == [t.type for t in golden.tabs]


def test_compose_page1_techname_order_matches_golden_05():
    form, golden = compose(SPEC_05), _golden("05_nadplata_podatku")
    ours = [q.field.techName for q in form.tabs[0].questions]
    theirs = [q.field.techName for q in golden.tabs[0].questions]
    assert ours == theirs


def test_compose_serialises_like_golden_shape():
    d = compose(SPEC_05).to_json_dict()
    assert set(d) == {"title", "tabs", "flow"}
    f = d["tabs"][0]["questions"][1]["field"]["repeatingSectionGrid"][0]["field"]
    assert set(f) >= {
        "id",
        "type",
        "techName",
        "title",
        "description",
        "options",
        "validation",
        "readOnly",
        "repeatingSectionGrid",
        "states",
        "questionOrder",
        "tooltipMessage",
    }
    assert len(d["flow"]["links"]) == len(d["tabs"]) - 1


def test_subject_section_named_like_template_does_not_collide():
    spec = FormSpec(
        title="x",
        pages=[
            PageSpec(
                title="P", sections=[SectionSpec(title="Dane do kontaktu", fields=[FieldSpec(label="Numer sprawy")])]
            )
        ],
    )
    form = compose(spec)
    names = [f.techName for _, f in form.iter_fields()]
    assert len(names) == len(set(names))
    assert not [v for v in check_rules(form) if v.severity == Severity.ERROR]


def test_address_uses_dictionaries_from_slowniki_document():
    """Mentor (Discord 2026-11-21): use the dictionaries from the Słowniki document, not TERYT_* from the examples."""
    form = compose(SPEC_05)
    used = {f.dictionaryName for _, f in form.iter_fields() if f.dictionaryName}
    assert {"Kraje", "Województwo", "Powiat", "Gmina", "Miejscowość", "Numery kierunkowe"} <= used
    assert not any(name.startswith("TERYT") for name in used)
    adres = next(q.field for q in form.tabs[0].questions if q.field.techName == "adres_zamieszkania")
    order = [f.techName for f in adres.iter_fields()]
    assert (
        order.index("wojewodztwo")
        < order.index("powiat")
        < order.index("gmina")
        < order.index("miejscowosc")
        < order.index("kod_pocztowy")
    )
    assert all(f.type == "SELECT" for _, f in form.iter_fields() if f.dictionaryName)


def test_rule_rejects_predefined_dictionary_outside_select():
    form = compose(SPEC_05)
    kraj = next(f for _, f in form.iter_fields() if f.techName == "kraj")
    kraj.type = FieldType.RADIO
    codes = [v.code for v in check_rules(form) if v.severity == Severity.ERROR]
    assert "DICTIONARY_SELECT_ONLY" in codes


def _cyclic_spec() -> FormSpec:
    """Self-reference, mutual reference and a section shown by its own field: all would stay hidden forever."""
    return FormSpec(
        title="x",
        pages=[
            PageSpec(
                title="P",
                sections=[
                    SectionSpec(
                        title="Wybory",
                        fields=[
                            FieldSpec(label="Tryb", kind=FieldType.RADIO, options=["A", "B"]),
                            FieldSpec(label="Sam", visible_when=[Condition(field="sam", value="x")]),
                            FieldSpec(label="Pierwsze", visible_when=[Condition(field="drugie", value="x")]),
                            FieldSpec(label="Drugie", visible_when=[Condition(field="pierwsze", value="x")]),
                            FieldSpec(label="Dla A", visible_when=[Condition(field="tryb", value="A")]),
                        ],
                    ),
                    SectionSpec(
                        title="Zamknięta",
                        visible_when=[Condition(field="wewnatrz", value="x")],
                        fields=[FieldSpec(label="Wewnątrz")],
                    ),
                ],
            )
        ],
    )


def test_rule_flags_condition_cycles():
    form = compose(SPEC_05)
    tab = form.tabs[1]
    sec = tab.questions[0].field
    f = next(sec.iter_fields())
    f.states = [show(jq.equals(tab.title, sec.techName, f.techName, "x"))]
    codes = [v.code for v in check_rules(form) if v.severity == Severity.ERROR]
    assert codes == ["STATE_CYCLE"]


def test_golden_forms_have_no_condition_cycles(golden_dict):
    codes = [v.code for v in check_rules(FormDefinition.from_json_dict(golden_dict))]
    assert "STATE_CYCLE" not in codes


def test_compose_drops_conditions_that_would_close_a_cycle():
    form = compose(_cyclic_spec())
    assert not [v for v in check_rules(form) if v.severity == Severity.ERROR]
    fields = {f.techName: f for _, f in form.iter_fields()}
    assert fields["dla_a"].states, "an acyclic condition must survive"
    assert not fields["sam"].states
    assert bool(fields["pierwsze"].states) != bool(fields["drugie"].states), "exactly one side of the pair is kept"
    assert not fields["zamknieta"].states


@pytest.mark.parametrize(
    "page_title,options",
    [
        ("Dane \u201ePrzedszkola\u201d i 'Żłobka'", ['Opcja "A"', "Opcja 'B'"]),
        ('Wybór "trybu"', ["Tak/Nie", "Ścieżka C:\\dane\\plik"]),
        ("Rodzic's choice", ["It's", 'Say "hi"']),
    ],
)
def test_conditions_with_quotes_and_backslashes_parse_and_evaluate(page_title, options):
    import jsonata

    from formgen.schema.jsonata_lint import lint_query

    form = compose(
        FormSpec(
            title="Test",
            pages=[
                PageSpec(
                    title=page_title,
                    sections=[
                        SectionSpec(
                            title="Wybór",
                            fields=[FieldSpec(label="Tryb", kind=FieldType.RADIO, options=options)],
                        ),
                        SectionSpec(
                            title="Szczegóły",
                            visible_when=[Condition(field="Tryb", value=options[1])],
                            fields=[FieldSpec(label="Opis")],
                        ),
                    ],
                )
            ],
        )
    )
    errors = [v for v in check_rules(form) if v.severity == Severity.ERROR]
    assert errors == [], "\n".join(map(str, errors))
    query = form.tabs[1].questions[1].field.states[0].query
    assert lint_query(query, form) == []
    data = form.to_json_dict()
    radio = data["tabs"][1]["questions"][0]["field"]["repeatingSectionGrid"][0]["field"]
    for answer, expected in [(options[0], False), (options[1], True), (options[0], False)]:
        radio["__userAnswer"] = [answer]
        assert jsonata.Jsonata(query).evaluate(data) is expected


def test_lint_reports_unknown_literal_with_escaped_quotes():
    from formgen.schema.jsonata_lint import lint_query

    form = compose(
        FormSpec(
            title="Test",
            pages=[
                PageSpec(
                    title="Strona 'A'",
                    sections=[
                        SectionSpec(
                            title="Wybór",
                            fields=[FieldSpec(label="Tryb", kind=FieldType.RADIO, options=['Opcja "A"', "Inna"])],
                        )
                    ],
                )
            ],
        )
    )
    tab = form.tabs[1].title
    good = '("Opcja \\"A\\"" in tabs["Strona \'A\'" in title].questions[\'wybor\' in field.techName]'
    good += ".field.repeatingSectionGrid['tryb' in field.techName].field.__userAnswer)"
    assert tab == "Strona 'A'"
    assert lint_query(good, form) == []
    bad = good.replace('Opcja \\"A\\"', 'Opcja \\"B\\"')
    assert [i.code for i in lint_query(bad, form)] == ["JSONATA_LITERAL"]
