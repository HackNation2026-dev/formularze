# Formularze — COI

Prywatne repozytorium przygotowawcze dla HackNation 2026. Organizacja docelowa: `HackNation2026-dev`. Wersja: **0.4.0**.

## Stan

Aplikacja działa end-to-end: upload pliku formularza (PDF/DOC/DOCX/ODS/XLSX/JPG/PNG) -> JSON `FormDefinition` dla Generatora Formularzy COI. Pipeline: parsery formatów -> lokalny LLM (llama.cpp, Qwen3.5-4B, gramatyka JSON) z fallbackiem heurystycznym -> deterministyczny kompilator szablonów COI -> walidator reguł. 82 testy (`make test`). Wyniki dla 7 formularzy do oceny: `data/output/`. Szczegóły implementacji: `docs/08-implementacja/`.

## Zacznij tutaj

1. [Indeks dokumentacji](docs/README.md)
2. [Zadanie](docs/01-zadanie/README.md)
3. [Materiały i pochodzenie](docs/02-materialy/README.md)
4. [Wymagania i odbiór](docs/03-wymagania/README.md)
5. [Architektura i stos](docs/04-architektura/README.md)
6. [Weryfikacja](docs/05-weryfikacja/README.md)
7. [Prezentacja i zgłoszenie](docs/06-prezentacja/README.md)
8. [Decyzje i pytania](docs/07-decyzje/README.md)
9. [Implementacja: problem, kontrakt API, research, pomiary](docs/08-implementacja/PROBLEM.md)

## Kontrola dokumentacji

```bash
python3 scripts/verify_docs.py
```

Skrypt kontroluje odnośniki lokalne i sumy materiałów. Nie testuje nieistniejącej jeszcze aplikacji.

## Wersjonowanie

Zobacz [zasady wersjonowania](docs/00-organizacja/wersjonowanie.md) i [historię zmian](CHANGELOG.md). Oryginały organizatora są oddzielone od opracowań zespołu. Zachowuj ich nazwy i bajty.

## Dostęp i sekrety

Repo ma pozostać prywatne. Klucze API przekazuj jury osobno; aplikacja ma czytać je z konfiguracji środowiska. Dane referencyjne pozostają materiałem organizatora. Repo nie nadaje im nowej licencji.

---

# Aplikacja

Przed pierwszym uruchomieniem testów: `python3 scripts/sync_materials.py` (kopiuje oryginały organizatora do `data/input/`).

## Budowanie obrazu Docker

```bash
cp .env.example .env            # ustaw JWT_SECRET
docker compose build            # obraz API: python:3.14.4-slim-trixie, user app (uid 1000), port 8000
```

Sidecary (pobierane, przypięte tagi): `ghcr.io/ggml-org/llama.cpp:server-b12602` (LLM, CPU), `apache/tika:3.3.0.0` (.doc).
Wagi modelu LLM: wrzuć plik GGUF do `./models/` (montowany tylko do odczytu). Żaden sekret ani model nie jest w obrazie.

## Uruchomienie

```bash
docker compose up               # API na http://localhost:8000, OpenAPI na /docs
python scripts/make_token.py    # JWT do nagłówka Authorization (albo AUTH_ENABLED=false w .env na demo)
curl -s -X POST http://localhost:8000/api/v1/forms/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF" \
  -o wynik.json
```

Lokalnie bez Dockera (dev):

```bash
/opt/homebrew/bin/python3.14 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/python -m formgen            # http://localhost:8000
.venv/bin/python -m pytest -q          # testy: golden JSON-y COI, composer, API
```

## Interfejs przeglądu `/review/`

Ten sam serwer udostępnia interfejs pod `http://localhost:8000/review/` (pkt 3.3 IV i V zadania). Urzędnik wczytuje blankiet PDF i JSON albo wysyła PDF do API. Widzi źródło obok wszystkich pól, symuluje e-usługę z warunkami JSONata, dodaje uwagi i pobiera czysty JSON oraz osobny raport uwag. Obraz Docker buduje zasoby UI w etapie Node. Lokalnie:

```bash
npm ci && npm run ui:assets      # PDF.js i JSONata z package-lock.json -> src/formgen/static/review/vendor/
make run                         # http://localhost:8000/review/
npm run check:ui && npm run test:ui   # składnia, format, zasoby; 13 testów Playwright (Chrome)
```

Szczegóły i scenariusz demonstracji: [UI-PRZEGLAD](docs/08-implementacja/UI-PRZEGLAD.md).

## Konfiguracja

Wszystko przez zmienne środowiskowe / `.env` (`src/formgen/api/settings.py`):

| Zmienna | Default | Opis |
|---|---|---|
| `APP_PORT` | 8000 | port API |
| `MAX_UPLOAD_SIZE_MB` | 25 | maksymalny rozmiar pliku (413 powyżej) |
| `ALLOWED_EXTENSIONS` | pdf,doc,docx,ods,xlsx,jpg,jpeg,png | whitelist rozszerzeń (case-insensitive) |
| `AUTH_ENABLED` | true | wymagaj JWT Bearer |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_LEEWAY_SECONDS` | –, HS256, –, –, 30 | weryfikacja tokenu |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TIMEOUT_SECONDS` | http://llm:8080, qwen3.5-4b, 600 | serwer zgodny z OpenAI z otwartym modelem: lokalny llama.cpp albo nasza chmura (`LLM_API_KEY`); `LLM_FALLBACK_BASE_URL` = lokalny zapas |
| `OCR_BACKEND`, `OCR_BASE_URL` | tesseract, – | tesseract / rapidocr / unlimited (sidecar GPU) |
| `DOC_CONVERTER_URL` | – | Apache Tika dla `.doc` |
| `EXTRACTOR` | llm | `llm` (lokalny llama.cpp), `heuristic` (bez modelu, tylko sygnały układu), `stub` (sam szablon) |
| `LLM_FALLBACK_HEURISTIC` | true | przy awarii/timeoucie LLM przełącz na `heuristic` zamiast błędu |
| `WITH_VALIDATORS`, `WITH_DICTIONARIES`, `WITH_DEPENDENCIES` | true | rozszerzenia opcjonalne I, III, V |
| `REQUEST_TIMEOUT_SECONDS`, `LOG_LEVEL` | 1800, INFO | |

## REST API

OpenAPI: `GET /docs`, `GET /openapi.json`. Błędy zawsze jako `{"error": {"code", "message", "details"}}`.

| Metoda i ścieżka | Auth | Opis |
|---|---|---|
| `POST /api/v1/forms/analyze` | Bearer | `multipart/form-data`, pole `file` (jeden plik). 200: JSON `FormDefinition`. Nagłówki: `X-Processing-Time-Ms`, `X-Detected-Type`, `X-Warnings` |
| `POST /api/v1/forms/validate` | Bearer | body = `FormDefinition` z opcjonalnym kluczem `sample_values` (techName -> wartość); zwraca `valid`, `errors`, `warnings` wg reguł technicznych COI oraz `sample_errors` (wartości niespełniające walidatorów pola) i `sample_unknown` (techName spoza formularza) |
| `GET /api/v1/formats` | – | obsługiwane rozszerzenia i limit rozmiaru |
| `GET /health`, `GET /ready` | – | liveness / readiness |
| `GET /review/` | – (wywołania API z UI używają tokena Bearer) | interfejs przeglądu i symulacji |

Kody błędów `analyze`: `400 MISSING_FILE`, `400 INVALID_FILENAME` (> 250 znaków lub znaki `; : > < / \ | ' * % $`),
`401 UNAUTHORIZED`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `415 MIME_MISMATCH` (zawartość sprawdzana
detektorem Google magika, musi zgadzać się z rozszerzeniem), `422 PROCESSING_FAILED`, `500 INVALID_OUTPUT`
(pipeline nigdy nie zwraca JSON-a łamiącego reguły), `503 MODEL_UNAVAILABLE`, `504 PROCESSING_TIMEOUT`.

Plik jest przetwarzany wyłącznie w pamięci i w katalogu tymczasowym żądania; nic nie jest zapisywane na stałe.
Nagłówek `X-Extractor` mówi, która ścieżka wygenerowała wynik (`LlmExtractor` lub `HeuristicExtractor` po awarii modelu).

## Pomiary (2026-11-21)

| Co | Gdzie | Wynik |
|---|---|---|
| Golden 05 (nadpłata podatku) vs JSON COI | M4, Qwen3.5-4B | composite 0.96, F1 0.92, stany SHOW 0.97, 65 s |
| Golden 01 (numer porządkowy) | M4 | composite 0.93, F1 0.87, 88 s |
| Qwen3.5-4B Q4 generacja | M4 Metal / GTX 1660 Ti | 12 tok/s / 59 tok/s |
| Golden 05 przez GPU (GTX 1660 Ti, Tailscale) | Legion | composite 0.96, 16 s |
| Formularz 6-stronicowy (08) | M4 / 1660 Ti | 634 s / 175 s |
| Formularz 16-stronicowy (09, 3 wnioski w 1) | 1660 Ti | 109 s, 7 stron, 90 pól, JSON poprawny |
| Tryb bez LLM (`heuristic`) na goldenach | – | composite 0.92–0.94 (szablon), przedmiot wniosku słabszy |

Skrypty: `make e2e` (jeden formularz vs golden), `make batch` (7 formularzy -> `data/output/`), `LLM_BASE_URL=http://host:port` kieruje na inny serwer llama.cpp (np. GPU przez Tailscale).

Świadoma decyzja: plik `.doc`, który w środku jest DOCX (tak jest w materiałach organizatora), jest akceptowany
i przetwarzany według zawartości.

## Struktura repo

- `src/formgen/schema/` – model `FormDefinition` (pydantic), reguły techniczne, lint JSONata
- `src/formgen/compose/` – spec pośredni i deterministyczny composer (strona „Dane”, kontakt, FINISH, adresy, JSONata, grid)
- `src/formgen/api/` – FastAPI, walidacja uploadu, JWT, konfiguracja
- `src/formgen/ingest/` – detekcja typu (magika), parsery formatów
- `src/formgen/eval/` – metryka porównania z JSON-ami wzorcowymi
- `src/formgen/static/review/` – interfejs przeglądu (bez frameworka, moduły ES); `tests/ui/` – testy Playwright
- `docs/08-implementacja/` – PROBLEM, SPEC, analiza materiałów, research, architektura, licencje
- `data/input/` – kopie robocze materiałów (tworzy `python3 scripts/sync_materials.py` z `docs/02-materialy/organizator`), `data/output/` – wygenerowane JSON-y dla 7 formularzy do oceny
