"""Dictionaries available in the COI Generator ("Hacknation - Słowniki").

Mentor answer (Discord, 2026-11-21 17:18): use the dictionaries and names from the dictionaries document.
The reference JSONs use register-specific equivalents (TERYT_DOWODOWY, TERYT_4G_DOWODOWY), which differ in detail.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from formgen.schema.model import FieldType

if TYPE_CHECKING:
    from formgen.compose.spec import FieldSpec

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


@dataclass(frozen=True)
class ProposedDictionary:
    """A new dictionary we propose to COI (docs/08-implementacja/NOWE-SLOWNIKI.md).

    The Generator does not know these names yet, so the values go inline into ``options``.
    """

    name: str
    kind: FieldType
    values: tuple[str, ...]
    pattern: re.Pattern[str]


PROPOSED: tuple[ProposedDictionary, ...] = (
    ProposedDictionary(
        name="Dyscypliny sportowe",
        kind=FieldType.CHECKBOX,
        values=(
            "gimnastyka artystyczna",
            "hokej",
            "karate",
            "kolarstwo",
            "koszykówka",
            "lekkoatletyka",
            "łucznictwo",
            "łyżwiarstwo",
            "narciarstwo klasyczne",
            "piłka nożna",
            "piłka ręczna",
            "piłka siatkowa",
            "piłka wodna",
            "sport motocyklowy",
            "sporty walki",
            "sporty wodne",
            "tenis stołowy",
            "tenis ziemny",
            "unihokej",
            "zapasy",
            "Inna dyscyplina",
        ),
        pattern=re.compile(r"dyscyplin", re.I),
    ),
    ProposedDictionary(
        name="Rasy psów wymagające zezwolenia",
        kind=FieldType.SELECT,
        values=(
            "amerykański pit bull terrier",
            "pies z Majorki (Perro de Presa Mallorquin)",
            "buldog amerykański",
            "dog argentyński",
            "pies kanaryjski (Perro de Presa Canario)",
            "tosa inu",
            "rottweiler",
            "akbash dog",
            "anatolian karabash",
            "moskiewski stróżujący",
            "owczarek kaukaski",
            "chart rasowy",
            "mieszaniec charta",
        ),
        pattern=re.compile(r"\brasa\b.*\bps|\brasy\b.*\bps|rasa psa", re.I),
    ),
    ProposedDictionary(
        name="Rodzaje podatków i opłat lokalnych",
        kind=FieldType.SELECT,
        values=(
            "podatek od nieruchomości",
            "podatek rolny",
            "podatek leśny",
            "podatek od środków transportowych",
            "łączne zobowiązanie pieniężne",
            "opłata skarbowa",
            "opłata targowa",
            "opłata miejscowa",
            "opłata uzdrowiskowa",
            "opłata reklamowa",
            "opłata od posiadania psów",
            "opłata za gospodarowanie odpadami komunalnymi",
        ),
        pattern=re.compile(r"rodzaj.*podatk|nazwa podatku|podatek, którego|podatku, którego|tytuł.*podatk", re.I),
    ),
)

# field kinds a proposed dictionary may replace when the extractor found no real choice list
_PROPOSABLE = frozenset(
    {FieldType.TEXT_FIELD, FieldType.TEXTAREA, FieldType.SELECT, FieldType.RADIO, FieldType.CHECKBOX}
)


def proposed_for(label: str) -> ProposedDictionary | None:
    """Proposed dictionary that fits a field label, or None."""
    text = label.strip().rstrip(":")
    return next((d for d in PROPOSED if d.pattern.search(text)), None)


def with_proposed(spec: FieldSpec) -> FieldSpec:
    """Fill a field from a proposed dictionary. Options the document gave (2 or more) win."""
    proposed = proposed_for(spec.label)
    if proposed is None or spec.dictionary or spec.kind not in _PROPOSABLE or len(spec.options) >= 2:
        return spec
    return spec.model_copy(
        update={
            "kind": proposed.kind,
            "options": list(proposed.values),
            "tooltip": spec.tooltip or f"Proponowany słownik: {proposed.name}",
        }
    )
