import pytest

from formgen.schema import (
    CHECKS,
    Validator,
    ade,
    email,
    epuap,
    failed_validators,
    id_card,
    nip,
    pesel,
    regon,
    required,
    zip_code,
)

CASES = [
    (pesel, "55030101193", True),
    (pesel, " 55030101193 ", True),
    (pesel, 55030101193, True),
    (pesel, "44051401359", True),
    (pesel, "55030101194", False),
    (pesel, "5503010119", False),
    (pesel, "5503010119a", False),
    (nip, "1234563218", True),
    (nip, "123-456-32-18", True),
    (nip, "123 456 32 18", True),
    (nip, "1234567890", False),
    (nip, "123456321", False),
    (nip, "12345632189", False),
    (regon, "123456785", True),
    (regon, "12345678512347", True),
    (regon, "123456786", False),
    (regon, "12345678512348", False),
    (regon, "12345678612347", False),
    (regon, "1234567851", False),
    (id_card, "ZZC108201", True),
    (id_card, "zzc108201", True),
    (id_card, "ZZC 108201", True),
    (id_card, "ZZC208201", False),
    (id_card, "ZZ1108201", False),
    (id_card, "ZZC  108201", False),
    (zip_code, "00-950", True),
    (zip_code, "31-001", True),
    (zip_code, "00950", False),
    (zip_code, "0-0950", False),
    (epuap, "/MRPiT/SkrytkaESP", True),
    (epuap, "/mnauka/SkrytkaESP", True),
    (epuap, "MRPiT/SkrytkaESP", False),
    (epuap, "/MRPiT/Skrytka ESP", False),
    (ade, "AE:PL-97086-47802-BUFIW-21", True),
    (ade, "AE:PL-12345-67890-ABCDE-00", True),
    (ade, "AE:PL-97086-47802-bufiw-21", False),
    (ade, "AE:PL-9708-47802-BUFIW-21", False),
    (email, "jan.kowalski@example.pl", True),
    (email, "a+b@urzad.gov.pl", True),
    (email, "jan.kowalski@example", False),
    (email, "jan kowalski@example.pl", False),
    (email, "@example.pl", False),
    (required, "x", True),
    (required, 0, True),
    (required, "", False),
    (required, "   ", False),
    (required, None, False),
]


@pytest.mark.parametrize(("check", "value", "expected"), CASES, ids=[f"{c.__name__}-{v!r}" for c, v, _ in CASES])
def test_validator(check, value, expected):
    assert check(value) is expected


def test_registry_covers_every_validator():
    assert set(CHECKS) == set(Validator)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("", [Validator.REQUIRED]),
        (None, [Validator.REQUIRED]),
        ("x", [Validator.PESEL]),
        ("55030101193", []),
    ],
)
def test_failed_validators_required_and_pesel(value, expected):
    assert failed_validators(["REQUIRED", Validator.PESEL], value) == expected


def test_empty_value_passes_optional_format_check():
    assert failed_validators([Validator.PESEL, Validator.EMAIL], "  ") == []
