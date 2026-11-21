"""Run the full pipeline on one input file against a running llama.cpp server and (optionally) score vs a golden JSON.

usage: python scripts/run_e2e.py <input file> [golden json] [--out out.json]
env:   LLM_BASE_URL (default http://127.0.0.1:8080)
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path

from formgen import pipeline
from formgen.api.settings import Settings
from formgen.eval.metric import compare
from formgen.extract import LlmExtractor
from formgen.extract.llm_client import LlmClient
from formgen.ingest.detect import detect_kind
from formgen.schema import FormDefinition, Severity

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    path = Path(args[0])
    data = path.read_bytes()
    kind, score = detect_kind(data)
    s = Settings(
        _env_file=None, llm_base_url=os.environ.get("LLM_BASE_URL", "http://127.0.0.1:8080"), auth_enabled=False
    )
    client = LlmClient(s.llm_base_url, s.llm_model, s.llm_timeout_seconds)
    if not client.alive():
        sys.exit(f"llama.cpp not reachable at {s.llm_base_url}")
    t0 = time.perf_counter()
    res = pipeline.run(data, kind, path.name, s, extractor=LlmExtractor(client))
    dt = time.perf_counter() - t0
    form = res.form
    print(f"\n=== {path.name} ({kind}, {score:.2f}) in {dt:.1f}s; llm calls: {client.calls}")
    print("title:", form.title)
    for tab in form.tabs:
        print(f"  [{tab.type}] {tab.title}")
        for q in tab.questions:
            sec = q.field
            print(f"     - {sec.title} ({sec.techName})" + (" [SHOW]" if sec.states else ""))
            if tab.title not in ("Dane", "Kontakt i zgody", "Kontakt z urzędem", "Strona końcowa"):
                for f in sec.iter_fields():
                    opts = f" opts={[o.name for o in f.options]}" if f.options else ""
                    print(f"         . {f.type:13} {f.title!r} {f.validation}{opts}" + (" [SHOW]" if f.states else ""))
    errs = [v for v in res.violations if v.severity == Severity.ERROR]
    print(
        "rule errors:",
        [str(e) for e in errs] or "none",
        "| warnings:",
        sum(v.severity == Severity.WARNING for v in res.violations),
    )
    if len(args) > 1:
        golden = FormDefinition.from_json_dict(json.loads(Path(args[1]).read_text(encoding="utf-8")))
        r = compare(form, golden)
        print("GOLDEN:", r.summary())
        print("  missing:", r.unmatched_golden)
        print("  extra:  ", r.unmatched_ours)
    if out:
        Path(out).write_text(json.dumps(form.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        print("written", out)


if __name__ == "__main__":
    main()
