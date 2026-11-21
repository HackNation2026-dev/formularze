"""F1 split: template tabs (Dane, Kontakt, Strona końcowa) vs subject-of-application tabs."""

import json

import pytest

from formgen.eval.metric import TEMPLATE_TABS, compare
from formgen.schema import FormDefinition
from tests.conftest import GOLDENS


def _load(path) -> FormDefinition:
    return FormDefinition.from_json_dict(json.loads(path.read_text(encoding="utf-8")))


@pytest.mark.parametrize("path", GOLDENS, ids=[p.stem for p in GOLDENS])
def test_golden_against_itself_scores_one_everywhere(path):
    g = _load(path)
    r = compare(g, g)
    assert (r.f1, r.f1_subject, r.f1_template) == (1.0, 1.0, 1.0)


@pytest.mark.parametrize("path", GOLDENS, ids=[p.stem for p in GOLDENS])
def test_form_with_only_template_tabs_has_zero_subject_f1(path):
    g = _load(path)
    ours = _load(path)
    ours.tabs = [t for t in ours.tabs if t.title in TEMPLATE_TABS]
    r = compare(ours, g)
    assert r.f1_template == 1.0
    assert r.f1_subject == 0.0
    assert r.f1 > 0.8, "overall F1 hides the missing subject fields; that is why the split exists"
    assert r.subject.tp + r.template.tp == r.tp and r.subject.fn + r.template.fn == r.fn
