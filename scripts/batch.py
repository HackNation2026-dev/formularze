"""Generate FormDefinition JSON for every form in data/input/04_formularze_do_oceny (one preferred source per form).

usage: python scripts/batch.py [--out data/output] [--ext pdf]
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from formgen import pipeline
from formgen.api.settings import Settings
from formgen.extract import LlmExtractor
from formgen.extract.llm_client import make_client
from formgen.ingest.detect import detect_kind
from formgen.schema import Severity

ROOT = Path(__file__).resolve().parents[1]
PREFER = ["pdf", "docx", "xlsx", "ods", "png", "jpg", "jpeg", "doc"]


def pick(folder: Path, ext: str | None) -> Path | None:
    files = {p.suffix.lower().lstrip("."): p for p in folder.iterdir() if p.is_file() and "wizualizacja" not in p.name}
    if ext:
        return files.get(ext)
    for e in PREFER:
        if e in files:
            return files[e]
    return None


def main() -> None:
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "data" / "output"
    ext = sys.argv[sys.argv.index("--ext") + 1] if "--ext" in sys.argv else None
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
    out_dir.mkdir(parents=True, exist_ok=True)
    s = Settings(
        _env_file=None, llm_base_url=os.environ.get("LLM_BASE_URL", "http://127.0.0.1:8080"), auth_enabled=False
    )
    client = make_client(s)
    if not client.alive():
        sys.exit(f"llama.cpp not reachable at {s.llm_base_url}")
    summary = []
    for folder in sorted((ROOT / "data" / "input" / "04_formularze_do_oceny").iterdir()):
        src = pick(folder, ext) if folder.is_dir() else None
        if not src or (only and not any(folder.name.startswith(o) for o in only)):
            continue
        data = src.read_bytes()
        kind, _ = detect_kind(data)
        t0 = time.perf_counter()
        res = pipeline.run(data, kind, src.name, s, extractor=LlmExtractor(client))
        dt = time.perf_counter() - t0
        errs = [str(v) for v in res.violations if v.severity == Severity.ERROR]
        target = out_dir / f"{folder.name}.json"
        target.write_text(json.dumps(res.form.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        n_fields = sum(1 for _ in res.form.iter_fields())
        summary.append(
            (
                folder.name,
                src.suffix,
                f"{dt:.0f}s",
                len(res.form.tabs),
                n_fields,
                "OK" if not errs else f"{len(errs)} errors",
            )
        )
        print(
            f"{folder.name:32} {src.suffix:6} {dt:6.0f}s tabs={len(res.form.tabs)} fields={n_fields} {'OK' if not errs else errs[:2]} -> {target.name}"
        )
    print("\n" + "\n".join(" | ".join(map(str, row)) for row in summary))


if __name__ == "__main__":
    main()
