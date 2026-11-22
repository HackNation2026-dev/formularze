"""Time the LLM extraction of a few forms against one endpoint (CPU llama.cpp by default), without any cache.

Prints per form: wall time, LLM calls, prompt and completion tokens, truncated answers, and the golden composite where
a golden exists, so a speed-up that costs quality shows up in the same table.

usage: LLM_BASE_URL=http://127.0.0.1:18082 python scripts/perf_extract.py [--forms 05,03,06] [--tag baseline]
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from formgen.compose import compose
from formgen.config import Settings
from formgen.eval.metric import compare
from formgen.extract import LlmExtractor
from formgen.extract.llm_client import make_client
from formgen.ingest import load
from formgen.ingest.detect import detect_kind
from formgen.schema import FormDefinition

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "input"


def pdf_of(prefix: str) -> Path:
    for parent in ("01_przyklady_formularze", "04_formularze_do_oceny"):
        for folder in (INPUT / parent).iterdir():
            if folder.name.startswith(prefix):
                return next(p for p in folder.iterdir() if p.suffix.lower() == ".pdf")
    raise SystemExit(f"no form {prefix}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--forms", default="05,03,06")
    ap.add_argument("--tag", default="")
    args = ap.parse_args()
    settings = Settings(_env_file=None, llm_base_url=os.environ.get("LLM_BASE_URL", "http://127.0.0.1:18082"))
    rows = []
    for prefix in args.forms.split(","):
        path = pdf_of(prefix)
        data = path.read_bytes()
        kind, _ = detect_kind(data)
        doc = load(data, kind)
        client = make_client(settings)
        t0 = time.perf_counter()
        spec = LlmExtractor(client).extract_document(doc, path.name, settings)
        wall = time.perf_counter() - t0
        form = compose(spec)
        calls = client.calls
        golden = INPUT / "02_przyklady_json" / f"{path.parent.name}.json"
        comp = None
        if golden.exists():
            comp = compare(
                form, FormDefinition.from_json_dict(json.loads(golden.read_text(encoding="utf-8")))
            ).composite()
        row = {
            "tag": args.tag,
            "form": prefix,
            "wall_s": round(wall, 1),
            "calls": len(calls),
            "prompt_tok": sum(c["prompt_tokens"] or 0 for c in calls),
            "completion_tok": sum(c["completion_tokens"] or 0 for c in calls),
            "truncated": sum(c["finish"] == "length" for c in calls),
            "fields": sum(1 for _ in form.iter_fields()),
            "golden": round(comp, 3) if comp is not None else None,
        }
        rows.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
    total = sum(r["wall_s"] for r in rows)
    print(f"TOTAL {args.tag} {total:.0f}s over {len(rows)} forms")


if __name__ == "__main__":
    main()
