"""Dictionaries available in the COI Generator ("Hacknation - Słowniki").

Mentor answer (Discord, 2026-11-21 17:18): use the dictionaries and names from the dictionaries document.
The reference JSONs use register-specific equivalents (TERYT_DOWODOWY, TERYT_4G_DOWODOWY), which differ in detail.
"""

from __future__ import annotations

import re

WOJEWODZTWO = "Województwo"
POWIAT = "Powiat"
GMINA = "Gmina"
MIEJSCOWOSC = "Miejscowość"
KRAJE = "Kraje"
NUMERY_KIERUNKOWE = "Numery kierunkowe"

# every predefined dictionary may only be attached to a drop-down list (SELECT)
SELECT_ONLY: frozenset[str] = frozenset({WOJEWODZTWO, POWIAT, GMINA, MIEJSCOWOSC, KRAJE, NUMERY_KIERUNKOWE})

# label pattern -> dictionary, checked in order (first match wins)
_LABEL_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"numer kierunkowy|prefiks telefon", re.I), NUMERY_KIERUNKOWE),
    (re.compile(r"\bkraj|\bpaństw|obywatelstw", re.I), KRAJE),
    (re.compile(r"województw", re.I), WOJEWODZTWO),
    (re.compile(r"\bpowiat", re.I), POWIAT),
    (re.compile(r"\bgmin[ay]?\b", re.I), GMINA),
    (re.compile(r"^miejscowość\b|\bmiejscowość$", re.I), MIEJSCOWOSC),
)


def dictionary_for(label: str) -> str | None:
    """Predefined dictionary that fits a field label, or None."""
    text = label.strip().rstrip(":")
    for pattern, name in _LABEL_RULES:
        if pattern.search(text):
            return name
    return None
