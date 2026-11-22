"""Names of the predefined dictionaries in the COI Generator ("Hacknation - Słowniki").

They live in the schema layer because the technical rules check them; the composer imports them from here."""

WOJEWODZTWO = "Województwo"
POWIAT = "Powiat"
GMINA = "Gmina"
MIEJSCOWOSC = "Miejscowość"
KRAJE = "Kraje"
NUMERY_KIERUNKOWE = "Numery kierunkowe"

# every predefined dictionary may only be attached to a drop-down list (SELECT)
SELECT_ONLY: frozenset[str] = frozenset({WOJEWODZTWO, POWIAT, GMINA, MIEJSCOWOSC, KRAJE, NUMERY_KIERUNKOWE})
