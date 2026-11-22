---
wersja: 0.2.0
aktualizacja: 2026-11-22
status: plan i stan wykonania
---

# Plan weryfikacji COI

## Stan wykonania (22.11)

Aplikacja istnieje (`src/formgen/`), plan poniżej jest w większości wykonany. Liczby z pomiarów 22.11:

| Co | Wynik | Dowód |
|---|---|---|
| Testy jednostkowe i API | 224 testy pytest | `make test`, `tests/unit/`, `tests/api/` |
| Interfejs `/review/` | testy Playwright | `tests/ui/review.spec.cjs`, `npm run test:ui` |
| Stos Docker na x86 bez GPU (i7-9750H) | 14/14 kontroli PASS na backendzie `d3f0b65`; analiza formularza 05 przez lokalny LLM 85 s | `scripts/verify_stack.sh` |
| Zgodność z JSON-ami wzorcowymi 01 / 05 | composite 0,925 / 0,919; recall 0,96 / 0,93; F1 0,86 / 0,84; F1 przedmiotu wniosku 0,75 / 0,50 | `src/formgen/eval/metric.py`, `tests/unit/test_golden.py` |
| SCORE smoke (01, 04, 05, 09) | 0,753; szum ok. 0,017 | `scripts/eval_suite.py`, `make eval-warm` |
| Wyniki do oddania | 9 JSON-ów, 0 błędów reguł w 9/9 (kod `d3f0b65`, GPU, `LLM_FALLBACK_HEURISTIC=false`) | `data/output/` |
| Praca bez Internetu | sieć `backend` bez trasy do Internetu; obraz `api` działa z `--network none` w trybie `heuristic` | `scripts/verify_stack.sh` |
| Walidacja uploadu (MIME, nazwa, rozmiar) | testy graniczne | `tests/api/test_analyze.py`, `src/formgen/api/upload.py` |

Otwarte z planu: punkt 8 (nowy formularz bez ręcznej poprawki) sprawdzi dopiero jury na nowych plikach.

## Plan


1. Użyj dwóch referencji JSON do budowy mapowania. Zachowaj ich status jako znanych przykładów.
2. Testuj osobno treść, strukturę, reguły biznesowe i wygląd wygenerowanej e-usługi.
3. Różne formaty tego samego formularza trzymaj w jednej grupie testowej. Unikaj przenikania treści pomiędzy zbiorem rozwojowym i kontrolnym.
4. Sprawdź każdy wymagany format, także stary DOC i skan.
5. Sprawdź przepływ, sekcje, wymagane pola, słowniki, stany JSONata i stronę końcową.
6. Sprawdź MIME, rozszerzenie, nazwę, rozmiar, czas przetwarzania i usunięcie pliku po błędzie.
7. Uruchom aplikację z przygotowanymi zasobami przy wyłączonym dostępie do Internetu.
8. Sprawdź nowy formularz bez ręcznej zmiany wyniku przez autorów.

Schemat JSON z paczki jest zbyt ogólny, by sam potwierdzał zgodność z regułami. Podgląd ma wynikać z wygenerowanego JSON, nie z osobno zakodowanego przykładu.

`python3 scripts/verify_docs.py` kontroluje wyłącznie dokumentację i materiały. Aplikację sprawdzają `make test`, `npm run test:ui` i `scripts/verify_stack.sh`.
