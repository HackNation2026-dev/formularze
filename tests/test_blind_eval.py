"""Testy scripts/blind_eval.py: roundtrip golden CSV <-> FormDefinition (issue #12).

Roundtrip pinujemy na goldenie 05: budujemy CSV z publicznego goldenu przez
leaves(), wczytujemy go read_golden_csv(), odbudowujemy golden_to_form()
i porównujemy z oryginałem metryką compare().
"""

import csv
import sys
from pathlib import Path

import pytest

from formgen.eval.metric import TEMPLATE_TABS, compare, leaves
from formgen.schema.model import CONTAINER_TYPES, Field, FieldType, FormDefinition, Question, Tab

_SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from blind_eval import golden_to_form, read_golden_csv  # noqa: E402

CSV_HEADER = ["strona", "sekcja", "etykieta", "typ", "wymagane", "warunek_show", "uwagi"]


def _required_by_tech(form: FormDefinition) -> dict[str, str]:
    out: dict[str, str] = {}
    for tab in form.tabs:
        for q in tab.questions:
            for f in q.field.iter_fields():
                if f.type not in CONTAINER_TYPES:
                    out[f.techName] = "tak" if "REQUIRED" in f.validation else "nie"
    return out


def csv_rows_from_form(form: FormDefinition) -> list[list[str]]:
    """Wiersze CSV z leaves(form); pomijamy taby szablonu (ta sama zasada co w golden_to_form)."""
    required = _required_by_tech(form)
    rows = [CSV_HEADER]
    for leaf in leaves(form):
        if leaf.tab in TEMPLATE_TABS:
            continue
        rows.append(
            [
                leaf.tab,
                leaf.section,
                leaf.title,
                leaf.type,
                required.get(leaf.tech, "nie"),
                "x = tak" if leaf.has_show else "",
                "",
            ]
        )
    return rows


def test_roundtrip_golden05(golden_path, golden_dict, tmp_path):
    if golden_path.stem != "05_nadplata_podatku":
        pytest.skip("roundtrip pinujemy na goldenie 05")
    golden = FormDefinition.model_validate(golden_dict)
    csv_path = tmp_path / "golden.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        csv.writer(fh).writerows(csv_rows_from_form(golden))
    ours = golden_to_form(read_golden_csv(csv_path))
    # porównujemy tylko taby z przedmiotu wniosku (taby szablonu nie są anotowane w CSV)
    tabs = {t.title for t in golden.tabs if t.title not in TEMPLATE_TABS}
    r = compare(ours, golden, tabs=tabs)
    assert r.f1 == 1.0
    assert r.type_acc == 1.0


def test_rejects_bad_type():
    rows = [
        {
            "strona": "Wniosek",
            "sekcja": "Dane",
            "etykieta": "Imię",
            "typ": "WRONG",
            "wymagane": "tak",
            "warunek_show": "",
        }
    ]
    with pytest.raises(ValueError):
        golden_to_form(rows)


def test_show_condition_sets_has_show():
    rows = [
        {
            "strona": "Wniosek",
            "sekcja": "Załączniki",
            "etykieta": "Pełnomocnictwo",
            "typ": "FILE_UPLOADER",
            "wymagane": "nie",
            "warunek_show": "Działam przez pełnomocnika = tak",
        }
    ]
    assert leaves(golden_to_form(rows))[0].has_show is True


def test_compare_ignores_template_tabs():
    rows_golden = [
        {
            "strona": "Wniosek",
            "sekcja": "Dane wniosku",
            "etykieta": "Imię",
            "typ": "TEXT_FIELD",
            "wymagane": "nie",
            "warunek_show": "",
        }
    ]
    rows_ours = [
        {
            "strona": "Wniosek o coś innego",
            "sekcja": "Dane wniosku",
            "etykieta": "Imię",
            "typ": "TEXT_FIELD",
            "wymagane": "nie",
            "warunek_show": "",
        },
    ]
    ours, golden = golden_to_form(rows_ours), golden_to_form(rows_golden)
    # wynik pipeline'u zawsze zawiera taby szablonu (golden_to_form ich nie tworzy) — symulujemy
    # ręcznie: tab "Dane" z sekcją i tym samym polem, co w tabie przedmiotu
    ours.tabs.append(
        Tab(
            title="Dane",
            questions=[
                Question(
                    field=Field(
                        type=FieldType.SECTION,
                        techName="dane_wnioskodawcy",
                        title="Dane wnioskodawcy",
                        repeatingSectionGrid=[
                            Question(field=Field(type=FieldType.TEXT_FIELD, techName="imie", title="Imię"))
                        ],
                    )
                )
            ],
        )
    )
    # bez filtra: pole z tabu szablonu w wyniku pipeline'u liczy się jako FP
    assert compare(ours, golden).fp == 1
    # z filtrem tabów (obie strony, bez szablonu): FP znika, pule "*" łączy różne nazwy tabów przedmiotu
    tabs = {t.title for form in (ours, golden) for t in form.tabs if t.title not in TEMPLATE_TABS}
    r = compare(ours, golden, tabs=tabs)
    assert r.fp == 0
    assert r.f1 == 1.0


def test_filters_template_tabs():
    rows = [
        {
            "strona": "Dane",
            "sekcja": "Dane wnioskodawcy",
            "etykieta": "Imię",
            "typ": "TEXT_FIELD",
            "wymagane": "tak",
            "warunek_show": "",
        }
    ]
    assert golden_to_form(rows).tabs == []
