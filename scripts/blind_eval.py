"""Ocena ekstrakcji na ślepym zbiorze formularzy (issue #12).

Dla każdego pliku formularza w ``blind-dir/formNN`` woła
``POST /api/v1/forms/analyze`` (multipart, bez auth: AUTH_ENABLED=false)
i porównuje wynik ``FormDefinition`` z goldenem z CSV miarą ``compare()``
z ``formgen.eval.metric`` (metryki nie duplikujemy).

CSV golden: nagłówek ``strona,sekcja,etykieta,typ,wymagane,warunek_show,uwagi``,
jedna linia na pole albo sekcję; taby szablonu (``metric.TEMPLATE_TABS``)
nie są anotowane i są odfiltrowywane po obu stronach porównania.

Pliki formularzy i CSV żyją poza repo (ślepota) — skrypt tylko je czyta.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import unicodedata
from pathlib import Path

import httpx

from formgen.eval.metric import TEMPLATE_TABS, Report, compare
from formgen.schema.model import (
    CONTAINER_TYPES,
    Field,
    FieldType,
    FormDefinition,
    Question,
    State,
    StateType,
    Tab,
    TabType,
    Validator,
)

CSV_HEADER = ("strona", "sekcja", "etykieta", "typ", "wymagane", "warunek_show", "uwagi")

# rozszerzenia plików formularzy branych do ewaluacji (golden.csv i notatki pomijamy)
FILE_EXTS = frozenset(
    {".pdf", ".docx", ".doc", ".odt", ".ods", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".rtf", ".txt"}
)

FORM_DIR_RE = re.compile(r"^form\d+$")
REQUEST_TIMEOUT_S = 3600.0  # LLM na CPU bywa wolny


def read_golden_csv(path: Path) -> list[dict[str, str]]:
    """Wiersze golden CSV jako dicty; strip wartości, pomijamy wiersze puste."""
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        rows: list[dict[str, str]] = []
        for raw in csv.DictReader(fh):
            row = {k: (v or "").strip() for k, v in raw.items()}
            if any(row.values()):
                rows.append(row)
        return rows


def _slug(text: str) -> str:
    norm = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(ch for ch in norm if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")


def _unique_tech(etykieta: str, used: set[str]) -> str:
    base = _slug(etykieta) or "pole"
    tech = base
    n = 1
    while tech in used:
        n += 1
        tech = f"{base}_{n}"
    used.add(tech)
    return tech


def golden_to_form(rows: list[dict[str, str]]) -> FormDefinition:
    """FormDefinition z wierszy golden CSV.

    Grupuje wiersze po ``strona`` -> taby (TabType.MAIN); wiersze z typem
    SECTION/REPEATING_SECTION tworzą sekcje (etykieta = tytuł sekcji), pozostałe
    wiersze są polami w sekcji z kolumny ``sekcja``. ``wymagane == "tak"``
    ustawia REQUIRED w validation (pole wymaganości w modelu to lista
    ``validation``, nie atrybut ``required``); ``warunek_show != ""`` ustawia
    stan SHOW na polu (albo na sekcji), jak w goldenie 05. Taby szablonu
    (``metric.TEMPLATE_TABS``) są pomijane. ValueError na typ spoza FieldType
    i na pole bez sekcji.
    """
    used: set[str] = set()
    tabs: dict[str, Tab] = {}
    sections: dict[tuple[str, str], Field] = {}

    def tab_for(title: str) -> Tab:
        tab = tabs.get(title)
        if tab is None:
            tab = Tab(title=title, type=TabType.MAIN)
            tabs[title] = tab
        return tab

    def section_for(tab_title: str, section_title: str) -> Field:
        key = (tab_title, section_title)
        section = sections.get(key)
        if section is None:
            section = Field(
                type=FieldType.SECTION,
                techName=_unique_tech(section_title, used),
                title=section_title,
            )
            sections[key] = section
            tab_for(tab_title).questions.append(Question(field=section))
        return section

    for row in rows:
        if not any(v for v in row.values() if (v or "").strip()):
            continue
        tab_title = (row.get("strona") or "").strip()
        if tab_title in TEMPLATE_TABS:
            continue
        try:
            ftype = FieldType((row.get("typ") or "").strip())
        except ValueError as exc:
            raise ValueError(f"typ poza FieldType w golden CSV: {row.get('typ')!r}") from exc
        warunek = (row.get("warunek_show") or "").strip()
        states = [State(type=StateType.SHOW, query=warunek)] if warunek else []

        if ftype in CONTAINER_TYPES:
            # wiersz sekcji: etykieta = tytuł sekcji; warunek widoczności idzie na sekcję
            section = section_for(tab_title, (row.get("etykieta") or "").strip())
            section.type = ftype
            if states:
                section.states = states
            continue

        sekcja = (row.get("sekcja") or "").strip()
        if not sekcja:
            raise ValueError(f"pole bez sekcji w golden CSV: {(row.get('etykieta') or '')!r} ({ftype})")

        field = Field(
            type=ftype,
            techName=_unique_tech((row.get("etykieta") or "").strip(), used),
            title=(row.get("etykieta") or "").strip(),
            validation=[Validator.REQUIRED] if (row.get("wymagane") or "").strip() == "tak" else [],
            states=states,
        )
        section_for(tab_title, sekcja).repeatingSectionGrid.append(Question(field=field))

    return FormDefinition(title="Blind set", tabs=list(tabs.values()))


def categorize(r: Report) -> dict[str, int]:
    """Kategorie błędów z raportu metryki."""
    return {
        "brakujace_pole": r.fn,
        "nadmiarowe_pole": r.fp,
        "zly_typ": r.tp - r.type_ok,
        "zla_sekcja": r.tp - r.section_ok,
        "brak_warunku": r.show_total - r.show_tp,
    }


def analyze_file(path: Path, base_url: str) -> tuple[FormDefinition, float, str]:
    """POST multipart do /api/v1/forms/analyze; zwrot (FormDefinition, czas_s, X-Extractor)."""
    start = time.perf_counter()
    with path.open("rb") as fh:
        resp = httpx.post(
            f"{base_url.rstrip('/')}/api/v1/forms/analyze",
            files={"file": (path.name, fh)},
            timeout=REQUEST_TIMEOUT_S,
        )
    elapsed = time.perf_counter() - start
    resp.raise_for_status()
    form = FormDefinition.from_json_dict(resp.json())
    return form, elapsed, resp.headers.get("X-Extractor", "")


def _print_table(rows: list[dict[str, str]]) -> None:
    if not rows:
        return
    cols = ("formularz", "plik", "composite", "f1", "type_acc", "show_recall", "czas_s", "x_extractor")
    widths = {c: max(len(c), *(len(r[c]) for r in rows)) for c in cols}
    print("  ".join(c.ljust(widths[c]) for c in cols))
    print("  ".join("-" * widths[c] for c in cols))
    for r in rows:
        print("  ".join(r[c].ljust(widths[c]) for c in cols))


def main() -> None:
    parser = argparse.ArgumentParser(description="Ocena ekstrakcji na ślepym zbiorze formularzy (issue #12)")
    parser.add_argument("--blind-dir", default="../blind-set-private", help="katalog z podkatalogami formNN")
    parser.add_argument("--base-url", default="http://localhost:8000", help="adres API /api/v1/forms/analyze")
    parser.add_argument("--out", default=None, help="ścieżka raportu CSV (domyślnie raport-surowy.csv obok blind-dir)")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    blind_dir = Path(args.blind_dir)
    out_path = Path(args.out) if args.out else blind_dir.parent / "raport-surowy.csv"
    form_dirs = sorted(p for p in blind_dir.iterdir() if p.is_dir() and FORM_DIR_RE.match(p.name)) if blind_dir.is_dir() else []
    if not form_dirs:
        print(f"brak podkatalogów formNN w {blind_dir}", file=sys.stderr)
        sys.exit(2)

    columns = [
        "formularz",
        "plik",
        "composite",
        "f1",
        "type_acc",
        "show_recall",
        "czas_s",
        "x_extractor",
        "brakujace_pole",
        "nadmiarowe_pole",
        "zly_typ",
        "zla_sekcja",
        "brak_warunku",
    ]
    out_rows: list[dict[str, str]] = []
    for form_dir in form_dirs:
        golden_csv = form_dir / "golden.csv"
        if not golden_csv.exists():
            print(f"pomijam {form_dir.name}: brak golden.csv", file=sys.stderr)
            continue
        golden = golden_to_form(read_golden_csv(golden_csv))
        for path in sorted(p for p in form_dir.iterdir() if p.is_file() and p.suffix.lower() in FILE_EXTS):
            try:
                form, elapsed, extractor = analyze_file(path, args.base_url)
            except Exception as exc:  # raportujemy i jedziemy dalej
                print(f"BŁĄD {path}: {exc}", file=sys.stderr)
                continue
            # porównujemy tylko taby z przedmiotu wniosku (filtr z obu stron, bez szablonu):
            # golden CSV nie ma tabów szablonu, a wynik pipeline'u zawsze je zawiera — bez filtra
            # policzyłyby się jako FP; _tab_key pule'uje nieszablonowe taby do "*", więc różne
            # nazwy tabów przedmiotu (nasze vs goldenowe) dalej się dopasują
            tabs = {t.title for f in (form, golden) for t in f.tabs if t.title not in TEMPLATE_TABS}
            report = compare(form, golden, tabs=tabs)
            row = {
                "formularz": form_dir.name,
                "plik": path.name,
                "composite": f"{report.composite():.3f}",
                "f1": f"{report.f1:.3f}",
                "type_acc": f"{report.type_acc:.3f}",
                "show_recall": f"{report.show_recall:.3f}",
                "czas_s": f"{elapsed:.1f}",
                "x_extractor": extractor,
                **{k: str(v) for k, v in categorize(report).items()},
            }
            out_rows.append(row)
            print(
                f"{form_dir.name} | {path.name} -> composite {row['composite']}, F1 {row['f1']}, "
                f"type {row['type_acc']}, show {row['show_recall']}, {row['czas_s']} s, X-Extractor: {extractor}"
            )

    _print_table(out_rows)
    if out_rows:
        n = len(out_rows)
        sums = {k: sum(int(r[k]) for r in out_rows) for k in columns[8:]}
        avgs = {k: sum(float(r[k]) for r in out_rows) / n for k in ("composite", "f1", "type_acc", "show_recall", "czas_s")}
        print(f"\nprzebiegi: {n}, średnie: " + ", ".join(f"{k}={v:.3f}" for k, v in avgs.items()))
        print("sumy błędów: " + ", ".join(f"{k}={v}" for k, v in sums.items()))
        with out_path.open("w", encoding="utf-8-sig", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=columns)
            writer.writeheader()
            writer.writerows(out_rows)
        print(f"zapisano {out_path}")
    else:
        print("brak przebiegów — raport nie zapisany", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
