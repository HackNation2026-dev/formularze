"""Frozen evaluation harness for subject-of-application extraction across all 9 forms and their formats.

For every form in data/input (2 reference forms with golden JSON + 7 evaluation forms) and every format
(PDF, DOCX, XLSX/ODS, PNG) it runs ingest -> LlmExtractor -> compose -> check_rules and scores:
  (a) golden    composite vs golden JSON (formgen.eval.metric), mean over formats; only forms 01 and 05
  (b) consist   label agreement of subject fields between formats of the same form (pairwise F1, rapidfuzz)
  (c) cover     share of document-model lines with '____' or '☐' that have a matching field label or option
  (d) noise     subject fields not supported by the source text + duplicate labels + check_rules findings,
                per subject field; reported as 1 - rate
Form score = mean of its available components; SCORE = mean of the 9 form scores.

LLM answers are cached on disk keyed by (system, user, schema, max_tokens), so a rerun with unchanged prompts
is deterministic and fast, and a change in to_spec is measured without LLM noise. --no-cache measures noise.

usage: LLM_BASE_URL=... LLM_API_KEY=... python scripts/eval_suite.py [--cache DIR] [--no-cache] [--out DIR]
       [--only 05,09] [--workers 2] [--sabotage]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from itertools import combinations
from pathlib import Path

from pydantic import BaseModel
from rapidfuzz import fuzz, process

from formgen.api.settings import Settings
from formgen.compose import compose
from formgen.eval.metric import FUZZ_MIN, TEMPLATE_TABS, compare
from formgen.extract import extractor as extractor_mod
from formgen.extract.llm_client import make_client
from formgen.extract.schema import json_schema
from formgen.ingest import load
from formgen.ingest.detect import detect_kind
from formgen.ingest.model import normalise
from formgen.schema import FormDefinition, Severity, check_rules
from formgen.schema.model import CONTAINER_TYPES

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "input"
GOLDEN = INPUT / "02_przyklady_json"
FORMATS = {"pdf": ("pdf",), "docx": ("docx",), "sheet": ("xlsx", "ods"), "png": ("png", "jpg", "jpeg")}
COVER_MIN = 70  # token_set_ratio between a fill/box line cue and a field label or option
GROUND_WORD_MIN = 80  # fuzz.ratio between a label word and a source word (absorbs Polish inflection)
# lines no subject field should ever cover: signature, place/date of filing, office-only boxes, office address
COVER_SKIP = re.compile(
    r"podpis|pieczęć|pieczątk|miejscowość,? data|data i miejsce|data wypełnienia|data złożenia|\bdnia\b"
    r"|wypełnia (urząd|organ|pracownik)|adnotacj|\b\d{2}-\d{3}\b|\bul\. |e-mail:|telefonicznie|\btel\."
    r"|administrator|danych osobowych|ochrony danych|poczty elektronicznej",
    re.I,
)
STOP = {
    "podaj", "wybierz", "wpisz", "zaznacz", "proszę", "jeżeli", "jeśli", "który", "która", "które", "którego",
    "twój", "twoja", "twoje", "twojego", "swój", "swoja", "swoje", "oraz", "albo", "lub", "czy", "będzie",
    "dotyczy", "wskaż", "określ", "informacja", "informacje", "mamy", "zrobić", "chcesz", "możesz", "należy",
}  # fmt: skip
log = logging.getLogger("eval_suite")


# ---------- running -----------------------------------------------------------------------------


class CachingClient:
    """Wraps an LLM client; answers (including invalid-output errors) are stored per prompt hash."""

    def __init__(self, inner, cache: Path | None):
        self.inner, self.cache = inner, cache
        self.hits = self.misses = self.retries = 0
        self.lock = threading.Lock()

    def complete[T: BaseModel](self, system: str, user: str, out: type[T], max_tokens: int = 4096) -> T:
        key = hashlib.sha256(
            json.dumps([system, user, out.__name__, json_schema(out), max_tokens], ensure_ascii=False).encode()
        ).hexdigest()
        path = self.cache / f"{key}.json" if self.cache else None
        if path and path.exists():
            rec = json.loads(path.read_text(encoding="utf-8"))
            with self.lock:
                self.hits += 1
            if "error" in rec:
                raise ValueError(rec["error"])
            return out.model_validate(rec["ok"])
        with self.lock:
            self.misses += 1
        try:
            res = self._call(system, user, out, max_tokens)
        except ValueError as exc:  # invalid model output is a deterministic answer too; connection errors are not
            if path:
                path.write_text(json.dumps({"error": str(exc)}, ensure_ascii=False), encoding="utf-8")
            raise
        if path:
            path.write_text(json.dumps({"ok": res.model_dump(mode="json")}, ensure_ascii=False), encoding="utf-8")
        return res

    def _call(self, system, user, out, max_tokens, attempts: int = 4):
        for i in range(attempts):  # the tailnet drops a connection now and then; that is not a model answer
            try:
                return self.inner.complete(system, user, out, max_tokens)
            except ValueError:
                raise
            except Exception as exc:
                if i == attempts - 1:
                    raise
                log.warning("LLM transport error (%s); retry %d", exc, i + 1)
                with self.lock:
                    self.retries += 1
                time.sleep(3 * (i + 1))


class SkipCounter(logging.Handler):
    def __init__(self):
        super().__init__(logging.WARNING)
        self.n = 0

    def emit(self, record):
        if "skipped" in record.getMessage():
            self.n += 1


@dataclass
class Unit:
    form: str
    fmt: str
    path: Path
    form_def: FormDefinition | None = None
    lines: list[str] = field(default_factory=list)
    source: str = ""
    error: str = ""
    seconds: float = 0.0


def discover(only: list[str] | None) -> dict[str, list[Unit]]:
    forms: dict[str, list[Unit]] = {}
    for parent in ("01_przyklady_formularze", "04_formularze_do_oceny"):
        for folder in sorted((INPUT / parent).iterdir()):
            if not folder.is_dir() or (only and not any(folder.name.startswith(o) for o in only)):
                continue
            files = {
                p.suffix.lower().lstrip("."): p
                for p in folder.iterdir()
                if p.is_file() and "wizualizacja" not in p.name.lower()
            }
            units = []
            for fmt, exts in FORMATS.items():
                src = next((files[e] for e in exts if e in files), None)
                if src:
                    units.append(Unit(folder.name, fmt, src))
            forms[folder.name] = units
    return forms


def run_unit(u: Unit, client: CachingClient, settings: Settings) -> None:
    t0 = time.perf_counter()
    try:
        data = u.path.read_bytes()
        kind, _ = detect_kind(data)
        doc = load(data, kind, tika_url=None)
        u.source = doc.text
        u.lines = doc.to_prompt_text().splitlines()
        spec = extractor_mod.LlmExtractor(client).extract_document(doc, u.path.name, settings)
        u.form_def = compose(spec)
    except Exception as exc:
        u.error = f"{type(exc).__name__}: {str(exc)[:160]}"
    u.seconds = time.perf_counter() - t0


# ---------- metrics -----------------------------------------------------------------------------


def subject_fields(form: FormDefinition) -> list:
    return [
        f
        for tab in form.tabs
        if tab.title not in TEMPLATE_TABS
        for q in tab.questions
        for f in q.field.iter_fields()
        if f.type not in CONTAINER_TYPES
    ]


def label_f1(a: list[str], b: list[str]) -> float:
    if not a and not b:
        return 1.0
    used: set[int] = set()
    tp = 0
    for x in a:
        for i, y in enumerate(b):
            if i not in used and fuzz.token_set_ratio(x, y, processor=str.lower) >= FUZZ_MIN:
                used.add(i)
                tp += 1
                break
    return 2 * tp / (len(a) + len(b)) if a or b else 1.0


def cue(line: str) -> str:
    t = re.sub(r"^#+\s*", "", line)
    t = re.sub(r"_{2,}|☐|☑|\[/?tabela\]", " ", t)
    t = re.sub(r"^\s*(\d{1,2}[\).]|[a-z]\))\s*", "", t)
    return re.sub(r"\s+", " ", t).strip(" :;.,-|")


def coverage(u: Unit) -> tuple[int, int, list[str]]:
    cues = []
    for ln in u.lines:
        n = normalise(ln)
        if ("____" in n or "☐" in n) and not COVER_SKIP.search(n):
            c = cue(n)
            if len(re.findall(r"[^\W\d_]{3,}", c)) >= 1:
                cues.append(c)
    if not cues:
        return 0, 0, []
    cands = []
    for _, f in u.form_def.iter_fields():
        if f.type in CONTAINER_TYPES:
            continue
        cands.append(f.title)
        cands.extend(o.name for o in f.options or [])
    cands = [c for c in cands if c and c.strip()]
    missed = [
        c
        for c in cues
        if not cands or process.extractOne(c, cands, scorer=fuzz.token_set_ratio, processor=str.lower)[1] < COVER_MIN
    ]
    return len(cues) - len(missed), len(cues), missed


def grounded(label: str, vocab: list[str]) -> bool:
    words = [w for w in re.findall(r"[^\W\d_]{4,}", label.lower()) if w not in STOP]
    if not words:
        return True
    ok = sum(1 for w in words if process.extractOne(w, vocab, scorer=fuzz.ratio, score_cutoff=GROUND_WORD_MIN))
    return ok / len(words) >= 0.5


def noise(u: Unit) -> dict:
    fields = subject_fields(u.form_def)
    vocab = sorted(set(re.findall(r"[^\W\d_]{4,}", u.source.lower())))
    ungrounded = [f.title for f in fields if not grounded(f.title, vocab)]
    seen: set[str] = set()
    dups = 0
    for f in fields:
        k = f.title.strip().lower()
        dups += k in seen
        seen.add(k)
    viol = check_rules(u.form_def)
    findings = len(viol)
    rate = (len(ungrounded) + dups + findings) / max(1, len(fields))
    return {
        "fields": len(fields),
        "ungrounded": len(ungrounded),
        "ungrounded_labels": ungrounded,
        "dups": dups,
        "rule_errors": sum(v.severity == Severity.ERROR for v in viol),
        "rule_warnings": sum(v.severity == Severity.WARNING for v in viol),
        "score": max(0.0, 1.0 - rate),
    }


def score_form(name: str, units: list[Unit]) -> dict:
    ok = [u for u in units if u.form_def is not None]
    golden_path = GOLDEN / f"{name}.json"
    row: dict = {
        "form": name,
        "formats": f"{len(ok)}/{len(units)}",
        "errors": [f"{u.fmt}: {u.error}" for u in units if u.error],
    }
    if golden_path.exists():
        golden = FormDefinition.from_json_dict(json.loads(golden_path.read_text(encoding="utf-8")))
        comps = []
        for u in units:
            if u.form_def is None:
                comps.append(0.0)
                continue
            r = compare(u.form_def, golden)
            no_err = not any(v.severity == Severity.ERROR for v in check_rules(u.form_def))
            comps.append(r.composite(validator_pass=no_err))
        row["golden"] = statistics.mean(comps)
        row["golden_per_fmt"] = {u.fmt: round(c, 3) for u, c in zip(units, comps, strict=True)}
    labels = {u.fmt: [f.title for f in subject_fields(u.form_def)] if u.form_def else [] for u in units}
    pairs = list(combinations(labels, 2))
    row["consist"] = statistics.mean(label_f1(labels[a], labels[b]) for a, b in pairs) if pairs else 1.0
    hits = total = 0
    row["cover_missed"] = {}
    for u in ok:
        h, t, missed = coverage(u)
        hits, total = hits + h, total + t
        row["cover_missed"][u.fmt] = missed
    if total:  # a form with no fill or box lines in any format has no coverage to measure
        row["cover"] = hits / total
    row["cover_lines"] = f"{hits}/{total}"
    nz = [noise(u) for u in ok]
    row["noise"] = statistics.mean(n["score"] for n in nz) * len(ok) / len(units) if nz else 0.0
    row["noise_detail"] = {u.fmt: {k: v for k, v in n.items() if k != "score"} for u, n in zip(ok, nz, strict=True)}
    row["fields"] = {u.fmt: len(labels[u.fmt]) for u in units}
    comps = [row[k] for k in ("golden", "consist", "cover", "noise") if k in row]
    row["score"] = statistics.mean(comps)
    return row


# ---------- main --------------------------------------------------------------------------------

SABOTAGE_PROMPT = """Poniżej fragment tekstu formularza. Zwróć jedną sekcję z jednym polem tekstowym.

TEKST ({pages}):
{text}"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cache", type=Path, default=Path(os.environ.get("EVAL_CACHE", Path.home() / ".cache" / "formgen-eval"))
    )
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--out", type=Path, default=None, help="write per-unit FormDefinition JSON and report.json here")
    ap.add_argument("--only", default="")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--sabotage", action="store_true", help="replace the section prompt with a broken one")
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    skips = SkipCounter()
    logging.getLogger("formgen.extract").addHandler(skips)
    if args.sabotage:
        extractor_mod.SECTIONS_USER = SABOTAGE_PROMPT
    settings = Settings(
        _env_file=None,
        llm_base_url=os.environ.get("LLM_BASE_URL", "http://127.0.0.1:8080"),
        llm_api_key=os.environ.get("LLM_API_KEY", ""),
        auth_enabled=False,
        llm_fallback_heuristic=False,
    )
    cache = None if args.no_cache else args.cache
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
    client = CachingClient(make_client(settings), cache)
    forms = discover([o for o in args.only.split(",") if o] or None)
    units = [u for us in forms.values() for u in us]
    t0 = time.perf_counter()
    with ThreadPoolExecutor(args.workers) as pool:
        list(pool.map(lambda u: run_unit(u, client, settings), units))
    wall = time.perf_counter() - t0
    rows = [score_form(name, us) for name, us in forms.items()]
    total = statistics.mean(r["score"] for r in rows)

    print(f"\n{'form':34} {'fmts':5} {'golden':>6} {'consist':>7} {'cover':>6} {'noise':>6} {'score':>6}  fields/fmt")
    for r in rows:
        g = f"{r['golden']:.3f}" if "golden" in r else "-"
        c = f"{r['cover']:.3f}" if "cover" in r else "-"
        flds = " ".join(f"{k}={v}" for k, v in r["fields"].items())
        print(
            f"{r['form']:34} {r['formats']:5} {g:>6} {r['consist']:7.3f} {c:>6} {r['noise']:6.3f} {r['score']:6.3f}  {flds}"
        )
    errors = [e for r in rows for e in r["errors"]]
    print(
        f"\nSCORE {total:.4f}  units={len(units)} ok={len(units) - len(errors)} errors={len(errors)} "
        f"llm_calls={client.hits + client.misses} cache_hits={client.hits} retries={client.retries} "
        f"chunks_skipped={skips.n} "
        f"wall={wall:.0f}s{' SABOTAGE' if args.sabotage else ''}"
    )
    for e in errors:
        print("  ERROR", e)
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        for u in units:
            if u.form_def:
                (args.out / f"{u.form}.{u.fmt}.json").write_text(
                    json.dumps(u.form_def.to_json_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
                )
        (args.out / "report.json").write_text(
            json.dumps({"score": total, "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    sys.exit(1 if len(errors) == len(units) else 0)


if __name__ == "__main__":
    main()
