"""Build the working data layout used by the pipeline and tests from the organiser's originals.

Originals stay untouched in docs/02-materialy/organizator (names and bytes preserved, see docs/00-organizacja).
This script only copies them into data/input/<numbered folders> that src/ and tests/ expect. Binary copies are
git-ignored; the two golden JSONs and the schema are copied as well.

usage: python3 scripts/sync_materials.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "02-materialy" / "organizator"
DST = ROOT / "data" / "input"

FOLDERS = {
    "1.": ("01_przyklady_formularze", "01_numer_porzadkowy_nieruchomosci"),
    "5.": ("01_przyklady_formularze", "05_nadplata_podatku"),
    "2.": ("04_formularze_do_oceny", "02_zwrot_oplaty_skarbowej"),
    "3.": ("04_formularze_do_oceny", "03_wydanie_zaswiadczenia"),
    "4.": ("04_formularze_do_oceny", "04_wynajecie_swietlicy"),
    "6.": ("04_formularze_do_oceny", "06_zajecie_pasa_drogowego"),
    "7.": ("04_formularze_do_oceny", "07_psy_rasy_agresywne"),
    "8.": ("04_formularze_do_oceny", "08_deklaracja_odpady"),
    "9.": ("04_formularze_do_oceny", "09_stypendium_sportowe"),
}
GOLDENS = {
    "konfiguracja_form_wniosekOUstalenieNumeruPorządkowegoNieruchomości (1).json": "01_numer_porzadkowy_nieruchomosci.json",
    "konfiguracja_form_wniosekOStwierdzenieNadpłatyPodatkuHacknation (2).json": "05_nadplata_podatku.json",
    "importowanyPlikJsonSchemat (1).json": "importowanyPlikJsonSchemat.json",
}


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"missing {SRC}")
    copied = 0
    for folder in sorted(SRC.iterdir()):
        key = folder.name.split(" ", 1)[0]
        if key in FOLDERS:
            group, slug = FOLDERS[key]
            target = DST / group / slug
            target.mkdir(parents=True, exist_ok=True)
            for f in folder.iterdir():
                if f.is_file() and f.suffix.lower() != ".json" and not f.name.startswith("."):
                    shutil.copy2(f, target / f.name)
                    copied += 1
                if f.suffix.lower() == ".json":
                    (DST / "02_przyklady_json").mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, DST / "02_przyklady_json" / GOLDENS.get(f.name, f.name))
                    copied += 1
        elif folder.name.startswith("Materiały"):
            for f in folder.iterdir():
                if f.name in GOLDENS:
                    (DST / "02_przyklady_json").mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, DST / "02_przyklady_json" / GOLDENS[f.name])
                    copied += 1
                elif f.suffix.lower() in (".pdf", ".docx") and "wizualizacja" not in f.name:
                    sub = (
                        "06_slowniki" if ("inicjalne" in f.name or "ownik" in f.name) else "05_wymagania_projektowanie"
                    )
                    (DST / sub).mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, DST / sub / f.name)
                    copied += 1
    print(f"copied {copied} files into {DST}")


if __name__ == "__main__":
    main()
