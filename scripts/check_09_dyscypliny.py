"""Integration check: form 09 must keep the sport-discipline checkbox list from the source document.

Runs the real LLM pipeline on the 09 PDF (or checks an existing output with --json) and fails when:
- there is no CHECKBOX whose options are exactly the disciplines listed in the source (each one, no extras),
- more than one field carries the discipline list (duplicate field),
- the free-text "Inna dyscyplina ____" field is missing,
- rule validation reports an ERROR.
The expected list is parsed from the source text, not hard-coded.

usage: LLM_BASE_URL=http://host:port python scripts/check_09_dyscypliny.py [--json out.json] [--out out.json]
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from pathlib import Path

from formgen import pipeline
from formgen.api.settings import Settings
from formgen.extract import LlmExtractor
from formgen.extract.llm_client import LlmClient
from formgen.ingest import load
from formgen.ingest.detect import detect_kind
from formgen.schema import FormDefinition, Severity, check_rules
from formgen.schema.model import FieldType

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/input/04_formularze_do_oceny/09_stypendium_sportowe/Wniosek o przyznanie stypendium.pdf"
OTHER_RE = re.compile(r"\binn\w*\b.*dyscyplin|dyscyplin.*\binn\w*\b", re.I)


def norm(s: str) -> str:
    return " ".join(s.casefold().split())


def source_disciplines(text: str) -> list[str]:
    """Checkbox lines after the 'Dyscypliny sportowe:' list header, up to the first non-checkbox line."""
    lines = text.splitlines()
    start = next(i for i, line in enumerate(lines) if line.strip() == "Dyscypliny sportowe:")
    out = []
    for line in lines[start + 1 :]:
        if not line.startswith("☐"):
            break
        out.append(line.lstrip("☐ ").strip())
    return out


def check(form: FormDefinition, expected: list[str]) -> list[str]:
    want = {norm(x) for x in expected}
    fields = [f for _, f in form.iter_fields()]
    carriers = [f for f in fields if len(want & {norm(o.name) for o in f.options}) >= 2]
    problems = []
    if len(carriers) != 1:
        problems.append(f"{len(carriers)} fields carry the discipline list, expected exactly 1")
    for f in carriers:
        got = {norm(o.name) for o in f.options}
        if f.type != FieldType.CHECKBOX:
            problems.append(f"{f.title!r} is {f.type}, expected CHECKBOX")
        if missing := sorted(want - got):
            problems.append(f"{f.title!r} misses {len(missing)} disciplines: {missing}")
        if extra := sorted(got - want):
            problems.append(f"{f.title!r} has options not in the source list: {extra}")
    if not any(OTHER_RE.search(f.title or "") and f.type in (FieldType.TEXT_FIELD, FieldType.TEXTAREA) for f in fields):
        problems.append("no text field for 'Inna dyscyplina'")
    errors = [str(v) for v in check_rules(form) if v.severity == Severity.ERROR]
    problems.extend(f"rule ERROR: {e}" for e in errors)
    return problems


def main() -> None:
    data = SOURCE.read_bytes()
    kind, _ = detect_kind(data)
    expected = source_disciplines(load(data, kind).to_prompt_text())
    print(f"source disciplines ({len(expected)}): {expected}")
    if "--json" in sys.argv:
        form = FormDefinition.from_json_dict(json.loads(Path(sys.argv[sys.argv.index("--json") + 1]).read_text()))
    else:
        s = Settings(
            _env_file=None, llm_base_url=os.environ.get("LLM_BASE_URL", "http://127.0.0.1:8080"), auth_enabled=False
        )
        client = LlmClient(s.llm_base_url, s.llm_model, s.llm_timeout_seconds)
        if not client.alive():
            sys.exit(f"llama.cpp not reachable at {s.llm_base_url}")
        form = pipeline.run(data, kind, SOURCE.name, s, extractor=LlmExtractor(client)).form
        if "--out" in sys.argv:
            out = Path(sys.argv[sys.argv.index("--out") + 1])
            out.write_text(json.dumps(form.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    for _, f in form.iter_fields():
        if "dyscyplin" in (f.title or "").lower():
            print(f"  {f.type:12} {f.title!r} {[o.name for o in f.options]}")
    problems = check(form, expected)
    print("FAIL\n  " + "\n  ".join(problems) if problems else "PASS")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
