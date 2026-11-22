---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: dokumentacja przygotowawcza
---

# Kontrakt i reguły COI

Korpus referencyjny ma konfiguracje dwóch formularzy. Plik schematu i opis pól są w paczce organizatora; dokładne ścieżki zawiera [rejestr](../02-materialy/rejestr.md).

## Struktura

Korzeń: `title`, `tabs`, `flow`. Zakładki zawierają pytania z pozycją `x`, `y`, rozmiarem `rows`, `cols` i obiektem `field`. Pole ma m.in. `id`, `type`, `techName`, `title`, `validation`, `dictionaryName`, `states`. Przepływ definiują `flow.links` z odwołaniami do zakładek.

## Reguły z dokumentu technicznego

- Tytuł formularza: maksymalnie 255 znaków.
- Co najmniej dwie strony. Ostatnia jest końcowa; przykłady opisują typy MAIN/FINISH, a dokument reguł używa też małych liter.
- Każda strona ma co najmniej jedno pole. Pola są zagnieżdżone w sekcji lub sekcji powtarzającej; sekcje nie zagnieżdżają się w innych sekcjach.
- Na stronie końcowej nie ma pól wejściowych; wskazano wyłącznie INFO_SECTION.
- Każde pole ma określoną obligatoryjność. Strony są powiązane przepływem.
- Zależności widoczności / tylko do odczytu opisują stany SHOW / READ_ONLY z wyrażeniami JSONata.
- Słowniki adresowe i krajów mają szczególne ograniczenia typu pola. Nie przenoś ogólnej zasady słowników na każdy komponent.

Typy z reguł obejmują TEXT_FIELD, CHECKBOX, NUMBER, CONSENT_SECTION, SELECT, TEXTAREA, FILE_UPLOADER, RADIO, DATEPICKER, TEXT_BLOCK, INFO_SECTION, SECTION i REPEATING_SECTION.

Oryginalny JSON Schema nie egzekwuje wszystkich reguł biznesowych; walidator semantyczny jest osobnym etapem: `check_rules()` w `src/formgen/schema/rules.py` i lint JSONata w `src/formgen/schema/jsonata_lint.py` (stan 22.11). Literówki `repetingSectionGrid` / `repeatingSectionGrid` i `CONSENT_SECTIOM` opisano w [rozbieżnościach](../07-decyzje/rozbieznosci.md). Nie poprawiaj oryginałów bez zapisanej decyzji.
