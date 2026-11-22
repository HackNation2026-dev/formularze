---
wersja: 0.4.0
aktualizacja: 2026-11-22
status: implementacja
---

# SPEC: wymagania techniczne -> kontrakt rozwiązania

Źródło prawdy: `docs/zadanie.txt` sekcje 3.2, 4, 5, 6. Każde wymaganie ma ID (R-xx). Kod, testy i README odwołują się do tych ID.
Status: kolumny „Jak spełniamy” i sekcje B–D uzgodnione z kodem na `develop` (2026-11-22); pozycje oznaczone
„nie zaimplementowano” to propozycje, których nie ma w kodzie. Schemat potoku: [architektura.md](architektura.md).

## A. Wymagania obowiązkowe (z zadania, dosłownie)

| ID | Wymaganie (cytat/parafraza) | Jak spełniamy | Test |
|---|---|---|---|
| R-01 | REST API przyjmujące **pojedynczy plik** blankietu formularza | `POST /api/v1/forms/analyze`, `multipart/form-data`, pole `file` | `tests/api/test_analyze.py` |
| R-02 | Formaty: `.pdf .doc .docx .ods .xlsx .jpg .jpeg .png` | whitelist rozszerzeń, case-insensitive (`.PDF`, `.JPG` w danych!). `ingest/detect.py` mapuje też `.jpe` na jpeg, ale domyślny `ALLOWED_EXTENSIONS` go nie zawiera, więc upload `.jpe` dostaje 415 | parametryzowany test na plikach z `data/input/01_przyklady_formularze/` (`tests/api/test_analyze.py`) |
| R-03 | Odpowiedź: JSON z konfiguracją formularza do importu | `200 OK`, `application/json`, body = `FormDefinition` (schemat jak `data/input/02_przyklady_json/*.json`) | walidator pydantic |
| R-04 | Walidacja typu: tylko obsługiwane formaty + **MIME zgodny z rozszerzeniem** | detektor Google `magika` (ONNX w wheelu, bez libmagic) na zawartości + mapa rozszerzenie->kind (`src/formgen/ingest/detect.py`); `.doc` z zawartością DOCX dopuszczone. Niezgodność -> `415 MIME_MISMATCH` | `test_mime_mismatch_png_as_pdf` |
| R-05 | Nazwa pliku <= 250 znaków | `len(filename) <= 250` -> inaczej `400` | test 251 znaków |
| R-06 | Nazwa bez znaków `; : > < / \ \| ' * % $` | regex na zbiorze `;:<>/\\|'*%$` -> `400` | test każdego znaku |
| R-07 | Max rozmiar pliku **konfigurowalny parametrem aplikacji** | env `MAX_UPLOAD_SIZE_MB` (default 25). Sprawdzane po `Content-Length` i w trakcie streamu -> `413` | `test_too_large` (limit 10 MB w teście, plik 11 MB) |
| R-08 | Plik tylko w RAM / tmp **na czas żądania** | plik czytany strumieniowo do `bytes` i przetwarzany wyłącznie w pamięci (`src/formgen/api/upload.py`); żadnego katalogu tymczasowego, uploadów na dysku, bazy ani cache plików | brak osobnego testu; przegląd kodu (`read_limited` -> `bytes`) |
| R-09 | Kompletna konfiguracja Docker, odizolowane środowisko | `Dockerfile` + `compose.yaml` (`api`, `llm`, `tika`); OCR w obrazie `api` | `scripts/verify_stack.sh` (stos z `docker compose`, 14 kontroli) |
| R-10 | Oficjalne obrazy bazowe | `python:3.14.4-slim-trixie`, `node:22.23.1-alpine3.24` (etap budowy UI), `ghcr.io/ggml-org/llama.cpp:server-b12602`, `apache/tika:3.3.0.0` | review Dockerfile |
| R-11 | Lekkie dystrybucje (np. Alpine) | API na `python:3.14.4-slim-trixie` (Tesseract i `pol` z apt); Alpine odrzucone: pakiety binarne (onnxruntime dla magika, pypdfium2) bez kół musl | rozmiar obrazu w README |
| R-12 | Jawne wersjonowanie, bez `latest` | wszystkie tagi przypięte (patrz R-10), zależności Pythona w `requirements.txt`, zasoby UI w `package-lock.json` | `scripts/verify_stack.sh` (kontrola `:latest` w `compose.yaml` i `Dockerfile`) |
| R-13 | Proces na dedykowanym userze z ograniczonymi uprawnieniami | `useradd --uid 1000 app`, `USER app`, `read_only: true`, `tmpfs` na `/tmp`, `cap_drop: [ALL]`, `no-new-privileges` (także dla `llm` i `tika`) | `docker inspect` |
| R-14 | Tylko wymagane porty | API: `${APP_PORT:-8000}:8000`; `llm` i `tika` bez `ports:`, w sieci `backend` z `internal: true` | compose review |
| R-15 | Sekrety tylko w runtime (env / secrets) | `JWT_SECRET` itp. z env lub `docker secrets`; brak sekretów w obrazie i repo; `.env.example` | grep w obrazie |
| R-16 | Konfiguracja: max rozmiar, **parametry JWT**, parametry integracyjne | `pydantic-settings`, sekcja C | README |
| R-17 | README: build Docker, uruchomienie, konfiguracja, opis REST API | README z tymi 4 nagłówkami + OpenAPI pod `/docs` | review |
| R-18 | Dokumentacja architektury (3.2.II) | [architektura.md](architektura.md) + diagram ze ścieżkami modułów | review |
| R-19 | Python >= 3.14 | `requires-python = ">=3.14"`, obraz 3.14 | CI |
| R-20 | Tylko open source bez copyleft; zero zewnętrznych API/SaaS/MCP; LLM lokalny | [LICENSES.md](LICENSES.md) = lista zależności z licencjami; brak wychodzących połączeń (sieć `backend` `internal`, kontrola `scripts/verify_stack.sh`: brak trasy do Internetu, obraz `api` działa z `--network none`) | CI |
| R-21 | Jury uruchamia na nowych plikach na żywo | pomiary w `README.md` sekcja „Pomiary”; limit `REQUEST_TIMEOUT_SECONDS` (1800) per plik; wywołania LLM równolegle (`LLM_PARALLEL`), warm-up prefiksu po starcie | benchmark w README |

## B. Kontrakt REST API (stan kodu)

Wersjonowanie: prefiks `/api/v1`. OpenAPI generowane przez FastAPI pod `/docs` i `/openapi.json`.

### `POST /api/v1/forms/analyze` (R-01, obowiązkowy)
- Auth: `Authorization: Bearer <JWT>` (gdy `AUTH_ENABLED=true`, domyślnie true; dla demo jury można wyłączyć env-em).
- Body: `multipart/form-data`, pole `file` (jeden plik). Pola `office_name` i `options` z pierwotnej propozycji nie zostały zaimplementowane: nazwę urzędu ustala model, a rozszerzenia włączają zmienne `WITH_VALIDATORS` / `WITH_DICTIONARIES` / `WITH_DEPENDENCIES`.
- 200: `FormDefinition` JSON. Nagłówki: `X-Processing-Time-Ms`, `X-Detected-Type` (`<kind>;score=`), `X-Warnings`, `X-Extractor` (`LlmExtractor` | `HeuristicExtractor`). `X-Pipeline-Trace-Id` nie istnieje.
  `X-Partial-Result: true|false` i przy `true` `X-Partial-Reasons` (przyczyny rozdzielone `; `, każda liczona w `X-Warnings`), żeby urzędnik nie wziął formularza z pominiętym fragmentem źródła za kompletny.
- Błędy (JSON `{"error": {"code": "...", "message": "...", "details": {...}}}`):
  - `400 INVALID_FILENAME` (R-05, R-06), `400 MISSING_FILE`
  - `401 UNAUTHORIZED` (JWT brak/niepoprawny/wygasły)
  - `413 FILE_TOO_LARGE` (R-07)
  - `415 UNSUPPORTED_MEDIA_TYPE` (rozszerzenie spoza listy) / `415 MIME_MISMATCH` (R-04)
  - `422 PROCESSING_FAILED` zarezerwowany, obecnie nieemitowany: pusty skan kończy się formularzem z samym szablonem i `X-Partial-Result`/`X-Warnings`
  - `503 MODEL_UNAVAILABLE` (LLM niedostępny i fallback heurystyczny wyłączony)
  - `504 PROCESSING_TIMEOUT`

### `POST /api/v1/forms/analyze-batch` (zaimplementowane, rozszerzenie VI „batch”) – pole `files` powtórzone (≤ `MAX_BATCH_FILES`), pliki po kolei, każdy z własnym timeoutem; `{"results": [...], "ok", "failed"}`, błąd jednego pliku nie przerywa paczki
### `POST /api/v1/forms/analyze/async` + `GET /api/v1/jobs/{id}` – nie zaimplementowano (synchroniczny `analyze` z timeoutem 1800 s wystarczył)
### `POST /api/v1/forms/validate` – przyjmuje JSON `FormDefinition` (+ opcjonalnie `sample_values`), zwraca `valid`, `errors`, `warnings`, `sample_errors`, `sample_unknown`
### `GET /api/v1/formats` – obsługiwane rozszerzenia i limit rozmiaru
### `GET /api/v1/dictionaries` – nie zaimplementowano (nazwy słowników: `src/formgen/schema/dictionaries.py`, propozycje: `NOWE-SLOWNIKI.md`)
### `GET /health` (bez auth, liveness), `GET /ready` (pyta LLM: `degraded` gdy tylko fallback heurystyczny, `503` gdy fallback wyłączony)
### `GET /review/` – interfejs przeglądu (rozszerzenie IV/V): upload, podgląd PDF obok pól, symulacja JSONata, eksport; `GET /` nie istnieje

## C. Konfiguracja (R-07, R-16) – zmienne środowiskowe

| Zmienna | Default | Opis |
|---|---|---|
| `APP_PORT` | `8000` | port API |
| `MAX_UPLOAD_SIZE_MB` | `25` | R-07 |
| `ALLOWED_EXTENSIONS` | `pdf,doc,docx,ods,xlsx,jpg,jpeg,png` | R-02 |
| `AUTH_ENABLED` | `true` | wyłączalne na demo |
| `JWT_SECRET` | – (wymagane gdy auth on) | HS256 secret, tylko runtime (R-15) |
| `JWT_ALGORITHM` | `HS256` | lub RS256 + `JWT_PUBLIC_KEY_PATH` |
| `JWT_ISSUER`, `JWT_AUDIENCE` | opcjonalne | weryfikacja claimów |
| `JWT_LEEWAY_SECONDS` | `30` | |
| `LLM_BASE_URL` | `http://llm:8080` | llama.cpp server (OpenAI-compatible), lokalny |
| `LLM_MODEL` | `qwen3.5-4b` | |
| `LLM_API_KEY` | – | Bearer do endpointu w chmurze, tylko runtime |
| `LLM_FALLBACK_BASE_URL`, `LLM_FALLBACK_MODEL` | – | zapasowy endpoint (zwykle lokalny `llm`) po awarii głównego |
| `LLM_TIMEOUT_SECONDS` | `600` | jedno wywołanie modelu; po nim fallback heurystyczny |
| `LLM_PARALLEL` | `2` | wywołania jednego formularza w locie naraz |
| `LLM_WARM_UP` | `false` (compose: `true`) | prefill prefiksu promptów po starcie |
| `LLM_CACHE_DIR` | – | tylko ewaluacja |
| `LLM_CONTEXT_TOKENS` | `8192` | kontekst jednego slotu llama.cpp (`-c` / `-np`); prompt + odpowiedź chunku muszą się zmieścić |
| `OCR_BACKEND`, `OCR_BASE_URL` | `tesseract`, – | zarezerwowane; kod używa wyłącznie Tesseracta |
| `DOC_CONVERTER_URL` | – (compose: `http://tika:9998`) | Apache Tika dla `.doc`; bez niego zgrubny odczyt tekstu |
| `EXTRACTOR` | `llm` | `llm` / `heuristic` / `stub` |
| `LLM_FALLBACK_HEURISTIC` | `true` | awaria LLM -> `HeuristicExtractor` zamiast 503 |
| `WITH_VALIDATORS`, `WITH_DICTIONARIES`, `WITH_DEPENDENCIES` | `true` | rozszerzenia I, III, V |
| `REQUEST_TIMEOUT_SECONDS` | `1800` | R-21, per plik (także w batchu) |
| `MAX_BATCH_FILES` | `20` | limit `analyze-batch` |
| `LOG_LEVEL` | `INFO` | |

Helper: `scripts/make_token.py` generuje JWT do testów z `JWT_SECRET`.

## D. Walidacja wejścia – kolejność (fail fast)
1. Auth (401) -> 2. obecność pliku (400) -> 3. `Content-Length` powyżej limitu (413) -> 4. nazwa: znaki, długość (400) -> 5. rozszerzenie na whitelist (415) -> 6. licznik strumienia w porcjach 1 MB (413) -> 7. zawartość wg magika vs rozszerzenie (415) -> 8. przetwarzanie w pamięci (`pipeline.run` w wątku, limit `REQUEST_TIMEOUT_SECONDS` -> 504) -> 9. walidacja wyjścia pydantic + reguły techniczne (500 jeśli nasz pipeline wyprodukował zły JSON; nigdy nie zwracamy niepoprawnego). Kod: `src/formgen/api/upload.py`, `app.py`.

Mapa MIME (R-04): `pdf: application/pdf`; `doc: application/msword`; `docx: application/vnd.openxmlformats-officedocument.wordprocessingml.document`; `xlsx: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; `ods: application/vnd.oasis.opendocument.spreadsheet`; `jpg/jpeg: image/jpeg`; `png: image/png`. Uwaga: docx/xlsx to ZIP; magika rozróżnia je po zawartości (`docx` vs `xlsx`), bez dodatkowego odczytu `[Content_Types].xml`.

## E. Deliverables (sekcja 4 zadania) – checklista (stan 22.11)
Pierwotnie planowane ścieżki `docs/opis-projektu.md`, `deliverables/` i `docs/architektura.md` nie powstały; poniżej faktyczne miejsca.
- [x] Tytuł + szczegółowy opis projektu (`README.md`, sekcja „Zgłoszenie”)
- [ ] Prezentacja PDF max 10 slajdów (w toku w `docs/06-prezentacja/`; szkic `prezentacja-szkic-2026-11-22.pdf`)
- [x] Wynikowe JSON-y dla 7 formularzy do oceny + 2 referencyjne dla porównania (`data/output/*.json`)
- [ ] Film max 3 min, link w README (otwarte repo)
- [x] Repozytorium kodu (public GitHub) z README wg R-17
- [x] [architektura.md](architektura.md) (R-18), [LICENSES.md](LICENSES.md) (R-20)
- opcjonalnie: screeny, link do demo

## F. Decyzje (rozstrzygnięte w kodzie)
1. Alpine vs slim dla API: slim (`python:3.14.4-slim-trixie`), bo zależności binarne nie mają kół musl.
2. Sync vs async: tylko synchroniczny `analyze` (timeout 1800 s) + `analyze-batch`; async nie powstał.
3. `.doc`: Apache Tika (Apache-2.0) jako sidecar `tika`; LibreOffice odrzucone.
4. JWT na demo: `AUTH_ENABLED=true` domyślnie, token ze `scripts/make_token.py`; `make run` wyłącza auth do szybkiego pokazu.
