"""The deterministic composer must reproduce the template pages of the golden files."""

import json

import pytest

from formgen.compose import ApplicantKinds, FieldSpec, FormSpec, PageSpec, SectionSpec, compose
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
