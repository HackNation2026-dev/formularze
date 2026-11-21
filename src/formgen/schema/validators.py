"""Polish field validators keyed by the ``Validator`` enum.

Algorithms and sources: docs/08-implementacja/research/03-generator-formularzy-coi.md section 3.4.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable, Mapping
from typing import Any

from formgen.schema.model import FormDefinition, Validator

_PESEL_WEIGHTS = (1, 3, 7, 9, 1, 3, 7, 9, 1, 3)
_NIP_WEIGHTS = (6, 5, 7, 2, 3, 4, 5, 6, 7)
_REGON9_WEIGHTS = (8, 9, 2, 3, 4, 5, 6, 7)
_REGON14_WEIGHTS = (2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8)
_ID_CARD_WEIGHTS = (7, 3, 1, 9, 7, 3, 1, 7, 3)

_ZIP_RE = re.compile(r"[0-9]{2}-[0-9]{3}")
_EPUAP_RE = re.compile(r"/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+")
_ADE_RE = re.compile(r"AE:PL-[0-9]{5}-[0-9]{5}-[A-Z]{5}-[0-9]{2}")
_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}")
_ID_CARD_RE = re.compile(r"([A-Z]{3}) ?([0-9]{6})")


def _text(value: object) -> str:
    return str(value).strip()


def _digits(value: object, *lengths: int) -> list[int] | None:
    s = _text(value)
    if len(s) not in lengths or not s.isascii() or not s.isdigit():
        return None
    return [int(c) for c in s]


def _weighted(digits: Iterable[int], weights: Iterable[int]) -> int:
    return sum(d * w for d, w in zip(digits, weights, strict=False))


def pesel(value: object) -> bool:
    d = _digits(value, 11)
    return d is not None and (10 - _weighted(d, _PESEL_WEIGHTS) % 10) % 10 == d[10]


def nip(value: object) -> bool:
    d = _digits(_text(value).replace("-", "").replace(" ", ""), 10)
    return d is not None and _weighted(d, _NIP_WEIGHTS) % 11 == d[9]


def regon(value: object) -> bool:
    d = _digits(value, 9, 14)
    if d is None or _weighted(d, _REGON9_WEIGHTS) % 11 % 10 != d[8]:
        return False
    return len(d) == 9 or _weighted(d, _REGON14_WEIGHTS) % 11 % 10 == d[13]


def id_card(value: object) -> bool:
    m = _ID_CARD_RE.fullmatch(_text(value).upper())
    if m is None:
        return False
    chars = m[1] + m[2]
    values = [ord(c) - ord("A") + 10 if c.isalpha() else int(c) for c in chars]
    return _weighted(values, _ID_CARD_WEIGHTS) % 10 == 0


def zip_code(value: object) -> bool:
    return _ZIP_RE.fullmatch(_text(value)) is not None


def epuap(value: object) -> bool:
    return _EPUAP_RE.fullmatch(_text(value)) is not None


def ade(value: object) -> bool:
    return _ADE_RE.fullmatch(_text(value)) is not None


def email(value: object) -> bool:
    return _EMAIL_RE.fullmatch(_text(value)) is not None


def required(value: object) -> bool:
    return value is not None and _text(value) != ""


CHECKS: dict[Validator, Callable[[object], bool]] = {
    Validator.REQUIRED: required,
    Validator.EMAIL: email,
    Validator.PESEL: pesel,
    Validator.NIP: nip,
    Validator.REGON: regon,
    Validator.ZIP_CODE: zip_code,
    Validator.EPUAP: epuap,
    Validator.ADE: ade,
    Validator.SERIAL_NUMBER_ID_CARD: id_card,
}


def failed_validators(validators: Iterable[Validator | str], value: object) -> list[Validator]:
    """Validators from the list that the value does not pass. Empty value (None or blank) fails only REQUIRED."""
    names = [Validator(v) for v in validators]
    if not required(value):
        return [v for v in names if v == Validator.REQUIRED]
    return [v for v in names if not CHECKS[v](value)]


def check_sample_values(
    form: FormDefinition, sample_values: Mapping[str, Any]
) -> tuple[list[dict[str, Any]], list[str]]:
    """Check sample values (techName -> value) against each field's ``validation`` list.

    Returns ``(sample_errors, sample_unknown)``: one error entry per field with failed validators,
    and the techNames that match no field of the form.
    """
    fields = {f.techName: f for _, f in form.iter_fields()}
    errors: list[dict[str, Any]] = []
    unknown: list[str] = []
    for tech_name, value in sample_values.items():
        field = fields.get(tech_name)
        if field is None:
            unknown.append(tech_name)
        elif failed := failed_validators(field.validation, value):
            errors.append({"techName": tech_name, "value": value, "failed": [str(v) for v in failed]})
    return errors, unknown
