"""Generate FormDefinition JSON for the evaluation forms (and optionally the two golden forms).

usage: python scripts/batch.py [--out data/output] [--ext pdf] [--only 03,08] [--jobs 4] [--goldens]
env:   LLM_BASE_URL, LLM_API_KEY, LLM_CACHE_DIR (cache model answers: a post-processing-only change re-runs in seconds)
"""

from __future__ import annotations

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
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


def _arg(name: str, default: str | None = None) -> str | None:
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main() -> None:
    out_dir = Path(_arg("--out", str(ROOT / "data" / "output")))
    ext = _arg("--ext")
    only = (_arg("--only") or "").split(",") if "--only" in sys.argv else None
    jobs = int(_arg("--jobs", "1"))
    out_dir.mkdir(parents=True, exist_ok=True)
    s = Settings(
        _env_file=None, auth_enabled=False, llm_base_url=os.environ.get("LLM_BASE_URL", "http://127.0.0.1:8080")
    )
    client = make_client(s)
    if not client.alive():
        sys.exit(f"llama.cpp not reachable at {s.llm_base_url}")
    folders = [ROOT / "data" / "input" / "04_formularze_do_oceny"]
    if "--goldens" in sys.argv:
        folders.append(ROOT / "data" / "input" / "01_przyklady_formularze")
    jobs_list = []
    for base in folders:
        for folder in sorted(base.iterdir()):
            src = pick(folder, ext) if folder.is_dir() else None
            if src and not (only and not any(folder.name.startswith(o) for o in only)):
                jobs_list.append((folder.name, src))

    def run_one(item):
        name, src = item
        data = src.read_bytes()
        kind, _ = detect_kind(data)
        t0 = time.perf_counter()
        res = pipeline.run(data, kind, src.name, s, extractor=LlmExtractor(client))
        dt = time.perf_counter() - t0
        errs = [str(v) for v in res.violations if v.severity == Severity.ERROR]
        (out_dir / f"{name}.json").write_text(
            json.dumps(res.form.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        n_fields = sum(1 for _ in res.form.iter_fields())
        return (
            name,
            src.suffix,
            f"{dt:.0f}s",
            len(res.form.tabs),
            n_fields,
            "OK" if not errs else f"{len(errs)} errors",
        )

    t_all = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        rows = list(pool.map(run_one, jobs_list))
    for row in rows:
        print(" | ".join(map(str, row)))
    cached = sum(1 for c in client.calls if c.get("cached"))
    print(f"\ntotal {time.perf_counter() - t_all:.0f}s, llm calls {len(client.calls)} (cached {cached}), jobs {jobs}")


if __name__ == "__main__":
    main()
