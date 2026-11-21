"""Golden files are the ground truth: they must load, round-trip and pass the rules."""

import json

from formgen.schema import FormDefinition, Severity, check_rules
from formgen.schema.jsonata_lint import parse_ok


def _normalise(d):
    """golden quirks: ``validation: {}`` means empty list; one section lacks ``states``."""
    if isinstance(d, dict):
        out = {k: ([] if k == "validation" and v == {} else _normalise(v)) for k, v in d.items()}
        if "type" in out and "techName" in out and "states" not in out:
            out["states"] = []
        return out
    if isinstance(d, list):
        return [_normalise(x) for x in d]
    return d


def test_golden_roundtrip(golden_dict):
    form = FormDefinition.from_json_dict(golden_dict)
    assert form.to_json_dict() == _normalise(golden_dict)


def test_golden_passes_rules(golden_dict):
    form = FormDefinition.from_json_dict(golden_dict)
    violations = check_rules(form)
    errors = [v for v in violations if v.severity == Severity.ERROR]
    assert errors == [], "\n".join(map(str, errors))


def test_golden_jsonata_parses(golden_dict):
    form = FormDefinition.from_json_dict(golden_dict)
    queries = [s.query for _, f in form.iter_fields() for s in f.states]
    assert queries, "golden has states"
    bad = {q: parse_ok(q) for q in queries if parse_ok(q)}
    assert bad == {}


def test_schema_file_still_describes_golden_top_level(golden_dict):
    schema = json.loads(
        (
            __import__("tests.conftest", fromlist=["GOLDEN_DIR"]).GOLDEN_DIR / "importowanyPlikJsonSchemat.json"
        ).read_text()
    )
    assert set(golden_dict) == set(schema["properties"])
