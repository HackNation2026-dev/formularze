---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# SPEC: wymagania techniczne -> kontrakt rozwiązania

Źródło prawdy: `docs/zadanie.txt` sekcje 3.2, 4, 5, 6. Każde wymaganie ma ID (R-xx). Kod, testy i README odwołują się do tych ID.
Status: propozycja do zatwierdzenia przez zespół.

## A. Wymagania obowiązkowe (z zadania, dosłownie)

| ID | Wymaganie (cytat/parafraza) | Jak spełniamy | Test |
|---|---|---|---|
| R-01 | REST API przyjmujące **pojedynczy plik** blankietu formularza | `POST /api/v1/forms/analyze`, `multipart/form-data`, pole `file` | `tests/api/test_analyze.py` |
| R-02 | Formaty: `.pdf .doc .docx .ods .xlsx .jpg .jpeg .png` | whitelist rozszerzeń, case-insensitive (`.PDF`, `.JPG` w danych!). `.jpe` traktujemy jak jpeg (bonus, poza listą) | parametryzowany test na 16 plikach referencyjnych |
| R-03 | Odpowiedź: JSON z konfiguracją formularza do importu | `200 OK`, `application/json`, body = `FormDefinition` (schemat jak `data/input/02_przyklady_json/*.json`) | walidator pydantic |
| R-04 | Walidacja typu: tylko obsługiwane formaty + **MIME zgodny z rozszerzeniem** | `libmagic` na pierwszych bajtach + mapa rozszerzenie->dozwolone MIME. Niezgodność -> `415` | test: `.pdf` z zawartością PNG -> 415 |
| R-05 | Nazwa pliku <= 250 znaków | `len(filename) <= 250` -> inaczej `400` | test 251 znaków |
| R-06 | Nazwa bez znaków `; : > < / \ \| ' * % $` | regex na zbiorze `;:<>/\\|'*%$` -> `400` | test każdego znaku |
| R-07 | Max rozmiar pliku **konfigurowalny parametrem aplikacji** | env `MAX_UPLOAD_SIZE_MB` (default 25). Sprawdzane po `Content-Length` i w trakcie streamu -> `413` | test z limitem 1 MB |
| R-08 | Plik tylko w RAM / tmp **na czas żądania** | `tempfile.TemporaryDirectory()` per request, `finally` usuwa; brak uploadów na dysku, brak bazy, brak cache plików | test: po żądaniu katalog tmp pusty |
| R-09 | Kompletna konfiguracja Docker, odizolowane środowisko | `Dockerfile` + `compose.yaml` (api, llm, ocr, [libreoffice]) | `docker compose up` w CI/skrypcie |
| R-10 | Oficjalne obrazy bazowe | `python:3.14.x-slim` / `-alpine`, `ghcr.io/ggml-org/llama.cpp:server-<tag>` | review Dockerfile |
| R-11 | Lekkie dystrybucje (np. Alpine) | API na Alpine jeśli zależności binarne pozwolą (libmagic, tesseract są w apk); inaczej slim z uzasadnieniem w README | rozmiar obrazu w README |
| R-12 | Jawne wersjonowanie, bez `latest` | wszystkie tagi przypięte (`python:3.14.4-alpine3.22`), zależności w `uv.lock` | grep `latest` w CI |
| R-13 | Proces na dedykowanym userze z ograniczonymi uprawnieniami | `adduser -D app`, `USER app`, read-only FS, `tmpfs` na `/tmp` | `docker inspect` |
| R-14 | Tylko wymagane porty | API: `8000`; LLM/OCR bez `ports:`, tylko sieć compose | compose review |
| R-15 | Sekrety tylko w runtime (env / secrets) | `JWT_SECRET` itp. z env lub `docker secrets`; brak sekretów w obrazie i repo; `.env.example` | grep w obrazie |
| R-16 | Konfiguracja: max rozmiar, **parametry JWT**, parametry integracyjne | `pydantic-settings`, sekcja C | README |
| R-17 | README: build Docker, uruchomienie, konfiguracja, opis REST API | README z tymi 4 nagłówkami + OpenAPI pod `/docs` | review |
| R-18 | Dokumentacja architektury (3.2.II) | `docs/architektura.md` + diagram | review |
| R-19 | Python >= 3.14 | `requires-python = ">=3.14"`, obraz 3.14 | CI |
| R-20 | Tylko open source bez copyleft; zero zewnętrznych API/SaaS/MCP; LLM lokalny | `docs/LICENSES.md` = lista zależności z licencjami; `pip-licenses` w CI blokuje GPL/AGPL; brak wychodzących połączeń (test z `--network none` dla API+LLM) | CI |
| R-21 | Jury uruchamia na nowych plikach na żywo | czas < ~2 min na 2-stronicowy formularz na maszynie demo; tryb async dla dużych | benchmark w README |

## B. Kontrakt REST API (propozycja)

Wersjonowanie: prefiks `/api/v1`. OpenAPI generowane przez FastAPI pod `/docs` i `/openapi.json`.

### `POST /api/v1/forms/analyze` (R-01, obowiązkowy)
- Auth: `Authorization: Bearer <JWT>` (gdy `AUTH_ENABLED=true`, domyślnie true; dla demo jury można wyłączyć env-em).
- Body: `multipart/form-data`, pole `file` (jeden plik). Opcjonalne pola: `office_name` (nazwa urzędu do sekcji "Urząd"), `options` (JSON: `{"dictionaries": true, "validators": true, "dependencies": true}`).
- 200: `FormDefinition` JSON. Nagłówki: `X-Processing-Time-Ms`, `X-Pipeline-Trace-Id`.
  `X-Partial-Result: true|false` i przy `true` `X-Partial-Reasons` (przyczyny rozdzielone `; `, każda liczona w `X-Warnings`), żeby urzędnik nie wziął formularza z pominiętym fragmentem źródła za kompletny.
- Błędy (JSON `{"error": {"code": "...", "message": "...", "details": {...}}}`):
  - `400 INVALID_FILENAME` (R-05, R-06), `400 MISSING_FILE`
  - `401 UNAUTHORIZED` (JWT brak/niepoprawny/wygasły)
  - `413 FILE_TOO_LARGE` (R-07)
  - `415 UNSUPPORTED_MEDIA_TYPE` (rozszerzenie spoza listy) / `415 MIME_MISMATCH` (R-04)
  - `422 PROCESSING_FAILED` (plik poprawny, ale nie da się wyekstrahować, np. pusty skan)
  - `503 MODEL_UNAVAILABLE` (LLM/OCR niedostępny)
  - `504 PROCESSING_TIMEOUT`

### `POST /api/v1/forms/analyze/async` -> `202 {"job_id": ...}`; `GET /api/v1/jobs/{id}` -> status/wynik (rozszerzenie VI "batch"; 16-stronicowy formularz może trwać minuty; wynik w pamięci procesu z TTL, bez dysku – R-08)
### `POST /api/v1/forms/validate` – przyjmuje JSON `FormDefinition`, zwraca listę naruszeń reguł technicznych (przydatne urzędnikowi i w testach)
### `GET /api/v1/dictionaries` – lista znanych słowników i źródeł danych inicjalnych (rozszerzenie I)
### `GET /health` (bez auth, liveness), `GET /ready` (sprawdza LLM/OCR)
### `GET /` – frontend (rozszerzenie IV/V): upload, batch, podgląd JSON, wizualizacja formularza

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
| `LLM_MODEL` | np. `qwen3-8b-q4_k_m` | |
| `LLM_TIMEOUT_SECONDS` | `300` | |
| `LLM_CONTEXT_TOKENS` | `8192` | kontekst jednego slotu llama.cpp (`-c` / `-np`); prompt + odpowiedź chunku muszą się zmieścić |
| `OCR_BACKEND` | `tesseract` / `paddle` / `vlm` | |
| `OCR_BASE_URL` | – | gdy OCR jako osobny serwis |
| `DOC_CONVERTER_URL` | – | LibreOffice/Tika service dla `.doc` (parametr integracyjny) |
| `REQUEST_TIMEOUT_SECONDS` | `600` | R-21 |
| `LOG_LEVEL` | `INFO` | |

Helper: `scripts/make_token.py` generuje JWT do testów z `JWT_SECRET`.

## D. Walidacja wejścia – kolejność (fail fast)
1. Auth (401) -> 2. obecność pliku (400) -> 3. nazwa: długość, znaki (400) -> 4. rozszerzenie na whitelist (415) -> 5. rozmiar: `Content-Length` i licznik strumienia (413) -> 6. MIME z libmagic vs rozszerzenie (415) -> 7. przetwarzanie w `TemporaryDirectory` -> 8. walidacja wyjścia pydantic + reguły techniczne (500 jeśli nasz pipeline wyprodukował zły JSON; nigdy nie zwracamy niepoprawnego).

Mapa MIME (R-04): `pdf: application/pdf`; `doc: application/msword`; `docx: application/vnd.openxmlformats-officedocument.wordprocessingml.document`; `xlsx: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; `ods: application/vnd.oasis.opendocument.spreadsheet`; `jpg/jpeg: image/jpeg`; `png: image/png`. Uwaga: docx/xlsx to ZIP; libmagic zwykle rozpoznaje, fallback: odczyt `[Content_Types].xml` i sprawdzenie `word/` vs `xl/`.

## E. Deliverables (sekcja 4 zadania) – checklista
- [ ] Tytuł + szczegółowy opis projektu (`README.md` góra + `docs/opis-projektu.md`)
- [ ] Prezentacja PDF max 10 slajdów (`deliverables/prezentacja.pdf`)
- [ ] Wynikowe JSON-y dla 7 formularzy do oceny (`deliverables/json/*.json`) + 2 referencyjne dla porównania
- [ ] Film max 3 min, link w README (otwarte repo)
- [ ] Repozytorium kodu (public GitHub) z README wg R-17
- [ ] `docs/architektura.md` (R-18), `docs/LICENSES.md` (R-20)
- opcjonalnie: screeny, link do demo

## F. Decyzje do potwierdzenia
1. Alpine vs slim dla API (zależy od zależności OCR). Preferencja zadania: Alpine. Decyzja po researchu 02.
2. Sync vs async jako główny endpoint dla jury. Propozycja: sync z timeoutem 10 min + async jako bonus.
3. `.doc` przez LibreOffice (MPL) w osobnym kontenerze – zapytać mentora; fallback: Apache Tika (Apache-2.0).
4. Czy JWT ma być wymagane na demo. Propozycja: `AUTH_ENABLED=true` w compose, token generowany skryptem, pokazujemy że działa.
