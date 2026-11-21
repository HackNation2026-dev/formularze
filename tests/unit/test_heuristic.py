"""The no-LLM extractor must produce a valid form and a reasonable share of the golden fields."""

import json

import pytest

from formgen.compose import compose
from formgen.eval.metric import compare
from formgen.extract.heuristic import extract_document
from formgen.ingest import load
from formgen.schema import FormDefinition, Severity, check_rules
from tests.conftest import GOLDEN_DIR, ROOT

CASES = [
    ("01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF", "05_nadplata_podatku"),
    (
        "01_przyklady_formularze/01_numer_porzadkowy_nieruchomosci/Wniosek o ustalenie numeru porządkowego nieruchomości.pdf",
        "01_numer_porzadkowy_nieruchomosci",
    ),
]


@pytest.mark.parametrize("src,golden", CASES)
def test_heuristic_valid_and_reasonable(src, golden):
    path = ROOT / "data" / "input" / src
    doc = load(path.read_bytes(), "pdf")
    spec = extract_document(doc, path.name)
    form = compose(spec)
    assert not [v for v in check_rules(form) if v.severity == Severity.ERROR]
    g = FormDefinition.from_json_dict(json.loads((GOLDEN_DIR / f"{golden}.json").read_text(encoding="utf-8")))
    r = compare(form, g)
    print(golden, r.summary(), r.unmatched_golden, r.unmatched_ours)
    assert r.recall >= 0.7
    assert spec.title.lower().startswith("wniosek")


def test_heuristic_every_eval_form_produces_valid_json():
    base = ROOT / "data" / "input" / "04_formularze_do_oceny"
    for folder in sorted(base.iterdir()):
        pdf = next(iter(sorted(p for p in folder.glob("*") if p.suffix.lower() == ".pdf")), None)
        if not pdf:
            continue
        form = compose(extract_document(load(pdf.read_bytes(), "pdf"), pdf.name))
        errors = [v for v in check_rules(form) if v.severity == Severity.ERROR]
        assert errors == [], (folder.name, errors[:3])
        assert sum(1 for _ in form.iter_fields()) > 20, folder.name
