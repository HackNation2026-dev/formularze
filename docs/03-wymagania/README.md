---
wersja: 0.2.0
aktualizacja: 2026-11-22
status: wymagania z dowodami spełnienia
---

# Wymagania COI

Stan na 22.11: wszystkie pozycje mają implementację; kolumna „Dowód” wskazuje kod albo test. Szczegółowe mapowanie wymagań R-xx: [SPEC.md](../08-implementacja/SPEC.md), checklista: [wymagania-checklist.md](../08-implementacja/wymagania-checklist.md).

| ID | Wymaganie | Kryterium odbioru | Dowód (22.11) |
|---|---|---|---|
| COI-01 | REST API przyjmujące pojedynczy blankiet | odpowiedź z konfiguracją JSON | `POST /api/v1/forms/analyze`, `tests/api/test_analyze.py` |
| COI-02 | PDF, DOC/DOCX, ODS, XLSX, JPG/JPEG, PNG | działający adapter każdego formatu | `src/formgen/ingest/` (pdf, office, image; `.doc` przez Tikę) |
| COI-03 | Kontrakt COI i reguły projektowania | walidacja struktury oraz reguł biznesowych | `src/formgen/schema/model.py`, `src/formgen/schema/rules.py` |
| COI-04 | Brak zależności od zewnętrznych API/MCP/SaaS w aplikacji | pełne przetwarzanie bez Internetu | `scripts/verify_stack.sh`: sieć `backend` bez Internetu, obraz `api` z `--network none` |
| COI-05 | Brak LLM dostępnego wyłącznie przez API | lokalny model lub inne lokalne metody | Qwen3.5-4B (Apache-2.0) w llama.cpp, kontener `llm` w `compose.yaml`; fallback heurystyczny |
| COI-06 | Komponenty open source bez wskazanego copyleft | spis wersji i warunków licencyjnych | [LICENSES.md](../08-implementacja/LICENSES.md) |
| COI-07 | Weryfikacja MIME, nazwy i rozmiaru | odrzucenie niewłaściwego pliku | `src/formgen/api/upload.py`, `tests/api/test_analyze.py` (415, 413, 400) |
| COI-08 | Nazwa do 250 znaków; zakazane znaki według opisu | testy graniczne nazwy | `tests/api/test_analyze.py` (każdy zakazany znak, 251 znaków) |
| COI-09 | Rozmiar pliku konfigurowalny | limit egzekwowany | `MAX_UPLOAD_SIZE_MB`, `test_too_large` |
| COI-10 | Wyłącznie tymczasowe przechowywanie pliku użytkownika | usunięcie po żądaniu także przy błędzie | plik tylko jako `bytes` w pamięci (`src/formgen/api/upload.py`); bez osobnego testu |
| COI-11 | Docker, jawne wersje, bez latest, ograniczony użytkownik | start według README | `Dockerfile` (`USER app`, przypięte tagi), `scripts/verify_stack.sh` 14/14 na x86 |
| COI-12 | Konfiguracja m.in. limitu oraz parametrów JWT | udokumentowane ustawienia | `src/formgen/config.py`, `README.md` „Konfiguracja” |
| COI-13 | Dokumentacja budowy, startu, konfiguracji i REST | samodzielne uruchomienie przez jury | `README.md` |
| COI-14 | Słowniki / dane inicjalne / nowe słowniki | rozszerzenia ocenione osobno | `src/formgen/schema/dictionaries.py`, `src/formgen/compose/dictionaries.py`, [NOWE-SLOWNIKI.md](../08-implementacja/NOWE-SLOWNIKI.md) |
| COI-15 | Zależności, GUI, podgląd i walidacje | rozszerzenia ocenione osobno | `src/formgen/compose/jsonata.py`, `/review/` (`src/formgen/static/review/`), `src/formgen/schema/validators.py`; osobne GUI `apps/web` |

Preferowane języki: Java 21+ albo Python 3.14+. Rust nie jest wskazany jako preferowany. [Kontrakt danych](kontrakt-danych.md) wyjaśnia reguły z paczki.

Oryginały materiałów w Git są zestawem konkursowym. COI-10 dotyczy plików przesyłanych przez użytkownika do działającej aplikacji, nie zakazuje wersjonowania otrzymanych materiałów konkursowych.
