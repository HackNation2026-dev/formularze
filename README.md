# Formularze — COI: cyfryzacja formularzy papierowych

Usługa REST, która z pliku papierowego formularza urzędowego (PDF, DOC, DOCX, ODS, XLSX, JPG, PNG) tworzy plik JSON
konfiguracji e-formularza dla Generatora Formularzy COI, razem z interfejsem przeglądu dla urzędnika. Działa na własnej
infrastrukturze, z otwartym modelem językowym uruchamianym lokalnie (bez zewnętrznych API).

Repozytorium zespołu Formularze na HackNation 2026 (publiczne). Organizacja: `HackNation2026-dev`. Wersja: **0.4.0**.

## Stan

Aplikacja działa end-to-end: upload pliku formularza (PDF/DOC/DOCX/ODS/XLSX/JPG/PNG) -> JSON `FormDefinition` dla Generatora Formularzy COI. Pipeline: parsery formatów -> lokalny LLM (llama.cpp, Qwen3.5-4B, gramatyka JSON) z fallbackiem heurystycznym -> deterministyczny kompilator szablonów COI -> walidator reguł. 196 testów (`make test`) i testy Playwright interfejsu. Wyniki dla 9 formularzy (2 wzorcowe i 7 do oceny): `data/output/`. Szczegóły implementacji: `docs/08-implementacja/`.

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

Skrypt kontroluje odnośniki lokalne i sumy materiałów. Aplikację testuje `make test` (sekcja Aplikacja niżej).

## Wersjonowanie

Zobacz [zasady wersjonowania](docs/00-organizacja/wersjonowanie.md) i [historię zmian](CHANGELOG.md). Oryginały organizatora są oddzielone od opracowań zespołu. Zachowuj ich nazwy i bajty.

## Dostęp i sekrety

Repo jest publiczne, więc żaden klucz ani sekret nie trafia do repo ani do obrazu. Klucze API przekazujemy jury osobno; aplikacja czyta je ze zmiennych środowiskowych. Dane referencyjne pozostają materiałem organizatora. Repo nie nadaje im nowej licencji.

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

Ten sam serwer udostępnia interfejs pod `http://localhost:8000/review/` (pkt 3.3 IV i V zadania). Urzędnik wczytuje blankiet PDF i JSON, wysyła PDF do API albo upuszcza kilka plików naraz i przełącza wyniki na liście wsadu. Widzi źródło obok wszystkich pól, symuluje e-usługę z warunkami JSONata, poprawia etykietę lub typ pola albo usuwa pole, dodaje uwagi i pobiera czysty JSON oraz osobny raport uwag. Obraz Docker buduje zasoby UI w etapie Node. Lokalnie:

```bash
npm ci && npm run ui:assets      # PDF.js i JSONata z package-lock.json -> src/formgen/static/review/vendor/
make run                         # http://localhost:8000/review/
npm run check:ui && npm run test:ui   # składnia, format, zasoby; 15 testów Playwright (Chrome)
```

Szczegóły i scenariusz demonstracji: [UI-PRZEGLAD](docs/08-implementacja/UI-PRZEGLAD.md).

## Konfiguracja

Wszystko przez zmienne środowiskowe / `.env` (`src/formgen/config.py`):

| Zmienna | Default | Opis |
|---|---|---|
| `APP_PORT` | 8000 | port API |
| `MAX_UPLOAD_SIZE_MB` | 25 | maksymalny rozmiar pliku (413 powyżej) |
| `ALLOWED_EXTENSIONS` | pdf,doc,docx,ods,xlsx,jpg,jpeg,png | whitelist rozszerzeń (case-insensitive) |
| `AUTH_ENABLED` | true | wymagaj JWT Bearer |
| `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_LEEWAY_SECONDS` | –, HS256, –, –, 30 | weryfikacja tokenu |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TIMEOUT_SECONDS` | http://llm:8080, qwen3.5-4b, 600 | serwer zgodny z OpenAI z otwartym modelem: lokalny llama.cpp albo ten sam model w chmurze |
| `LLM_API_KEY` | – | klucz do endpointu w chmurze (Bearer), tylko w runtime |
| `LLM_FALLBACK_BASE_URL`, `LLM_FALLBACK_MODEL` | – | zapas, zwykle lokalny `http://llm:8080`; używany po pierwszej awarii głównego endpointu |
| `LLM_CACHE_DIR` | – | tylko ewaluacja: cache sparsowanych odpowiedzi modelu na dysku; nie ustawiać w produkcji |
| `OCR_BACKEND`, `OCR_BASE_URL` | tesseract, – | tesseract / rapidocr / unlimited (sidecar GPU) |
| `DOC_CONVERTER_URL` | – | Apache Tika dla `.doc` |
| `EXTRACTOR` | llm | `llm` (lokalny llama.cpp), `heuristic` (bez modelu, tylko sygnały układu), `stub` (sam szablon) |
| `LLM_FALLBACK_HEURISTIC` | true | przy awarii/timeoucie LLM przełącz na `heuristic` zamiast błędu |
| `WITH_VALIDATORS`, `WITH_DICTIONARIES`, `WITH_DEPENDENCIES` | true | rozszerzenia opcjonalne I, III, V |
| `REQUEST_TIMEOUT_SECONDS`, `LOG_LEVEL` | 1800, INFO | limit czasu na jeden plik (504 po przekroczeniu) |
| `MAX_BATCH_FILES` | 20 | maksymalna liczba plików w `analyze-batch` (413 powyżej) |

## REST API

OpenAPI: `GET /docs`, `GET /openapi.json`. Błędy zawsze jako `{"error": {"code", "message", "details"}}`.

| Metoda i ścieżka | Auth | Opis |
|---|---|---|
| `POST /api/v1/forms/analyze` | Bearer | `multipart/form-data`, pole `file` (jeden plik). 200: JSON `FormDefinition`. Nagłówki: `X-Processing-Time-Ms`, `X-Detected-Type`, `X-Warnings` |
| `POST /api/v1/forms/analyze-batch` | Bearer | `multipart/form-data`, pole `files` powtórzone (do `MAX_BATCH_FILES`). Pliki po kolei, każdy z własnym `REQUEST_TIMEOUT_SECONDS`. 200: `{"results": [{"filename", "status", "form" \| "error", "processing_time_ms", "extractor", ...}], "ok", "failed"}`; błąd jednego pliku nie przerywa paczki |
| `POST /api/v1/forms/validate` | Bearer | body = `FormDefinition` z opcjonalnym kluczem `sample_values` (techName -> wartość); zwraca `valid`, `errors`, `warnings` wg reguł technicznych COI oraz `sample_errors` (wartości niespełniające walidatorów pola) i `sample_unknown` (techName spoza formularza) |
| `GET /api/v1/formats` | – | obsługiwane rozszerzenia i limit rozmiaru |
| `GET /health`, `GET /ready` | – | liveness / readiness (`/ready` pyta LLM: `degraded` gdy działa tylko fallback heurystyczny, 503 gdy fallback wyłączony) |
| `GET /review/` | – (wywołania API z UI używają tokena Bearer) | interfejs przeglądu i symulacji |

Kody błędów `analyze`: `400 MISSING_FILE`, `400 INVALID_FILENAME` (> 250 znaków lub znaki `; : > < / \ | ' * % $`),
`401 UNAUTHORIZED`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `415 MIME_MISMATCH` (zawartość sprawdzana
detektorem Google magika, musi zgadzać się z rozszerzeniem), `422 PROCESSING_FAILED`, `500 INVALID_OUTPUT`
(pipeline nigdy nie zwraca JSON-a łamiącego reguły), `503 MODEL_UNAVAILABLE`, `504 PROCESSING_TIMEOUT`.

Plik jest przetwarzany wyłącznie w pamięci i w katalogu tymczasowym żądania; nic nie jest zapisywane na stałe.
Nagłówek `X-Extractor` mówi, która ścieżka wygenerowała wynik (`LlmExtractor` lub `HeuristicExtractor` po awarii modelu).

## Pomiary (stan 22.11)

| Co | Gdzie | Wynik |
|---|---|---|
| Wymagania Docker i API end-to-end (`scripts/verify_stack.sh`), develop `8a34858` | x86, bez GPU | 15/15; analiza przez lokalny model 98 s |
| Golden 05 i 01 vs JSON COI (słowniki z pliku „Słowniki”) | GPU przez tunel | composite 0,92 / 0,92; recall 0,95 / 0,96; ok. 19 s na formularz |
| SCORE na 4 formularzach smoke (01, 04, 05, 09), `make eval-warm` | cache odpowiedzi | 0,7363 w ok. 10 s |
| Rozmiar modelu na samym CPU (`docs/08-implementacja/research/ab-models-cpu.md`) | x86, 6 rdzeni | 0,8B / 2B / 4B: composite 0,89–0,93; prosty formularz 302 / 74 / 242 s |
| Qwen3.5-4B Q4, generacja | M4 Metal / GTX 1660 Ti / CPU x86 | 12 / 59 / ok. 11 tok/s |
| 9 formularzy do oddania (`data/output/`) | GPU przez tunel | 0 błędów reguł; 15–323 s na formularz |
| Tryb bez modelu (`EXTRACTOR=heuristic`) | – | JSON zawsze poprawny; przedmiot wniosku słabszy |

Szczegóły: `docs/08-implementacja/research/` (badania i pomiary), `docs/08-implementacja/DEMO-SETUP.md` (ustawienie na obronę).

## Ewaluacja jakości

Harness `scripts/eval_suite.py` liczy dla każdego z 9 formularzy i jego formatów: zgodność z JSON-em wzorcowym (01, 05),
zgodność pól między formatami, pokrycie linii z polami do wpisania i szum. SCORE to średnia z formularzy.

```bash
make eval-warm                  # smoke 01/04/05/09 z cache odpowiedzi, ok. 10 s, zero wywołań modelu
scripts/eval_fast.sh --cold     # po zmianie promptu: uzupełnia cache (model z LLM_BASE_URL)
make eval-full                  # wszystkie 9 formularzy na zimno, raz przed commitem
```

Zasady pętli są w `docs/08-implementacja/PLAN-ZESPOL.md`. Formularz 08 nie wchodzi do smoke.

## Model w chmurze

Mentor COI (21.11): maszyna jury nie ma GPU; model w chmurze wołany po API jest dozwolony, jeśli jest otwarty i możliwy
do postawienia na własnej infrastrukturze. Ten sam Qwen3.5-4B (Apache-2.0) działa lokalnie w kontenerze `llm` i na naszym
serwerze z GPU (`scripts/legion/serve_gpu.sh`: llama.cpp, klucz API, tunel HTTPS). Aplikacja przełącza się przez
`LLM_BASE_URL`, a przy braku sieci wraca do lokalnego modelu, potem do trybu bez modelu.

Świadoma decyzja: plik `.doc`, który w środku jest DOCX (tak jest w materiałach organizatora), jest akceptowany
i przetwarzany według zawartości.

## Struktura repo

Moduły, ich kontrakty, miary i kierunek importów (sprawdzany w CI przez `lint-imports`): [MODULY](docs/08-implementacja/MODULY.md).

- `src/formgen/schema/` – model `FormDefinition` (pydantic), reguły techniczne, lint JSONata
- `src/formgen/compose/` – spec pośredni i deterministyczny composer (strona „Dane”, kontakt, FINISH, adresy, JSONata, grid)
- `src/formgen/api/` – FastAPI, walidacja uploadu, JWT
- `src/formgen/config.py` – konfiguracja ze zmiennych środowiskowych (wszystkie warstwy)
- `src/formgen/extract/` – ekstrakcja przedmiotu wniosku (LLM, heurystyka, prompty)
- `src/formgen/pipeline.py` – spina etapy, fallback heurystyczny
- `src/formgen/ingest/` – detekcja typu (magika), parsery formatów
- `src/formgen/eval/` – metryka porównania z JSON-ami wzorcowymi
- `src/formgen/static/review/` – interfejs przeglądu (bez frameworka, moduły ES); `tests/ui/` – testy Playwright
- `docs/08-implementacja/` – PROBLEM, SPEC, analiza materiałów, research, architektura, licencje
- `data/input/` – kopie robocze materiałów (tworzy `python3 scripts/sync_materials.py` z `docs/02-materialy/organizator`), `data/output/` – wygenerowane JSON-y dla 9 formularzy
