# Formularze — COI: cyfryzacja formularzy papierowych

Usługa REST, która z pliku papierowego formularza urzędowego (PDF, DOC, DOCX, ODS, XLSX, JPG, PNG) tworzy plik JSON
konfiguracji e-formularza dla Generatora Formularzy COI, razem z interfejsem przeglądu dla urzędnika. Działa na własnej
infrastrukturze, z otwartym modelem językowym uruchamianym lokalnie (bez zewnętrznych API).

Repozytorium zespołu Formularze na HackNation 2026 (publiczne). Organizacja: `HackNation2026-dev`. Wersja: **0.4.0**.

## Stan

Aplikacja działa end-to-end: upload pliku formularza (PDF/DOC/DOCX/ODS/XLSX/JPG/PNG) -> JSON `FormDefinition` dla Generatora Formularzy COI. Pipeline: parsery formatów -> lokalny LLM (llama.cpp, Qwen3.5-4B, gramatyka JSON) z fallbackiem heurystycznym -> deterministyczny kompilator szablonów COI -> walidator reguł. 224 testów (`make test`) i 12 testów Playwright interfejsu `/review/`; osobna aplikacja GUI `apps/web` (Next.js) ma własne testy i CI `web.yml`. Wyniki dla 9 formularzy (2 wzorcowe i 7 do oceny): `data/output/`. Szczegóły implementacji: `docs/08-implementacja/`.

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

## Zgłoszenie

**Tytuł:** Formularze – cyfryzacja papierowych formularzy urzędowych do e-usług COI z otwartym modelem na własnej infrastrukturze.

**Opis:** Urzędnik wgrywa blankiet (PDF, DOC, DOCX, ODS, XLSX, JPG, PNG) i dostaje gotową konfigurację JSON e-formularza
dla Generatora Formularzy COI. Parsery formatów budują model dokumentu, lokalny otwarty model językowy (Qwen3.5-4B,
llama.cpp) wyodrębnia wyłącznie przedmiot wniosku, a deterministyczny kompilator szablonów dokłada strony i sekcje
wymagane standardem COI (dane wnioskodawcy, kontakt, zgody, strona końcowa), słowniki COI, warunki widoczności JSONata
i walidatory (PESEL, NIP, REGON, kod pocztowy, dowód). Każdy wynik przechodzi walidator reguł technicznych, więc usługa
nigdy nie zwraca JSON-a łamiącego zasady COI. Interfejs `/review/` pokazuje wynik obok źródła, symuluje e-usługę,
pozwala poprawić pola i pobrać czysty JSON z raportem. Całość działa w Dockerze bez usług zewnętrznych; ten sam model
może stać lokalnie na CPU albo na własnym serwerze GPU (jeden przełącznik `LLM_BASE_URL`).

| Element zgłoszenia | Gdzie |
|---|---|
| Kod i README | to repozytorium, gałąź `main` |
| Wynikowe JSON-y dla formularzy do oceny (7) i wzorcowych (2) | `data/output/` |
| Prezentacja (max 10 slajdów, PDF) | `docs/06-prezentacja/` (treść: `SLAJDY-I-FILM.md`) |
| Film (max 3 min) | `docs/06-prezentacja/` (scenariusz z minutażem: `SLAJDY-I-FILM.md`) |
| Architektura | `docs/04-architektura/`, `docs/08-implementacja/architektura.md` |
| Stan projektu i znane ograniczenia | `docs/08-implementacja/STAN-PROJEKTU.md` |

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
npm run check:ui && npm run test:ui   # składnia, format, zasoby; 12 testów Playwright (Chrome)
```

Szczegóły i scenariusz demonstracji: [UI-PRZEGLAD](docs/08-implementacja/UI-PRZEGLAD.md).

## Aplikacja GUI `apps/web` (Next.js)

Druga warstwa interfejsu nad tym samym REST API ([ADR-002](docs/07-decyzje/ADR-002-gui-nextjs.md)): logowanie tokenem, kolejka analizy wielu plików, kolorowany JSON, walidacja, podgląd e-usługi ze stanami JSONata, import JSON z dysku, PL/EN. Działa z mockiem API albo z backendem z tego repo. Nie jest częścią obrazu Docker backendu. Szczegóły i trasy: [apps/web/README.md](apps/web/README.md).

```bash
cd apps/web && npm ci && npm run dev     # http://localhost:3000/pl ; backend: NEXT_PUBLIC_API_MODE=live i NEXT_PUBLIC_API_BASE=http://localhost:8000 w .env.local
```

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
| `LLM_CONTEXT_TOKENS` | 8192 | kontekst jednego slotu llama.cpp; budżet odpowiedzi chunku = kontekst − prompt, poniżej 1024 tokenów chunk jest dzielony |
| `LLM_PARALLEL` | 2 | wywołania LLM jednego formularza w locie naraz (globalne + chunki); `LLM_PARALLEL × LLM_CONTEXT_TOKENS` ≤ `--ctx-size` serwera |
| `LLM_WARM_UP` | false (compose: true) | po starcie API prefilluj wspólny prefiks promptów w cache serwera LLM |
| `OCR_BACKEND`, `OCR_BASE_URL` | tesseract, – | zarezerwowane; kod OCR używa wyłącznie Tesseracta (`pol`) z obrazu `api`, wartości raportuje tylko `/ready` |
| `DOC_CONVERTER_URL` | – | Apache Tika dla `.doc` |
| `EXTRACTOR` | llm | `llm` (lokalny llama.cpp), `heuristic` (bez modelu, tylko sygnały układu), `stub` (sam szablon) |
| `LLM_FALLBACK_HEURISTIC` | true | przy awarii/timeoucie LLM przełącz na `heuristic` zamiast błędu |
| `WITH_VALIDATORS`, `WITH_DICTIONARIES`, `WITH_DEPENDENCIES` | true | rozszerzenia opcjonalne I, III, V |
| `REQUEST_TIMEOUT_SECONDS`, `LOG_LEVEL` | 1800, INFO | limit czasu na jeden plik (504 po przekroczeniu) |
| `MAX_BATCH_FILES` | 20 | maksymalna liczba plików w `analyze-batch` (413 powyżej) |
| `MAX_FILENAME_LENGTH`, `FORBIDDEN_FILENAME_CHARS` | 250, `; : > < / \ \| ' * % $` | walidacja nazwy pliku (400 `INVALID_FILENAME`) |

## REST API

OpenAPI: `GET /docs`, `GET /openapi.json`. Błędy zawsze jako `{"error": {"code", "message", "details"}}`.

| Metoda i ścieżka | Auth | Opis |
|---|---|---|
| `POST /api/v1/forms/analyze` | Bearer | `multipart/form-data`, pole `file` (jeden plik). 200: JSON `FormDefinition`. Nagłówki: `X-Processing-Time-Ms`, `X-Detected-Type`, `X-Warnings`, `X-Partial-Result` (`true`/`false`), `X-Partial-Reasons` (tylko przy `true`) |
| `POST /api/v1/forms/analyze-batch` | Bearer | `multipart/form-data`, pole `files` powtórzone (do `MAX_BATCH_FILES`). Pliki po kolei, każdy z własnym `REQUEST_TIMEOUT_SECONDS`. 200: `{"results": [{"filename", "status", "form" \| "error", "processing_time_ms", "extractor", "partial", "partial_reasons", ...}], "ok", "failed"}`; błąd jednego pliku nie przerywa paczki |
| `POST /api/v1/forms/validate` | Bearer | body = `FormDefinition` z opcjonalnym kluczem `sample_values` (techName -> wartość); zwraca `valid`, `errors`, `warnings` wg reguł technicznych COI oraz `sample_errors` (wartości niespełniające walidatorów pola) i `sample_unknown` (techName spoza formularza) |
| `GET /api/v1/formats` | – | obsługiwane rozszerzenia i limit rozmiaru |
| `GET /health`, `GET /ready` | – | liveness / readiness (`/ready` pyta LLM: `degraded` gdy działa tylko fallback heurystyczny, 503 gdy fallback wyłączony) |
| `GET /review/` | – (wywołania API z UI używają tokena Bearer) | interfejs przeglądu i symulacji |

Kody błędów `analyze`: `400 MISSING_FILE`, `400 INVALID_FILENAME` (> 250 znaków lub znaki `; : > < / \ | ' * % $`),
`401 UNAUTHORIZED`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `415 MIME_MISMATCH` (zawartość sprawdzana
detektorem Google magika, musi zgadzać się z rozszerzeniem), `500 INVALID_OUTPUT`
(pipeline nie zwraca JSON-a łamiącego reguły techniczne), `503 MODEL_UNAVAILABLE`, `504 PROCESSING_TIMEOUT`.
`analyze-batch` dodatkowo: `413 TOO_MANY_FILES`. `validate`: `422 INVALID_FORM_DEFINITION`, `422 INVALID_SAMPLE_VALUES`.
Każdy endpoint z tokenem: `500 AUTH_MISCONFIGURED`, gdy `AUTH_ENABLED=true` bez `JWT_SECRET`.

Plik jest przetwarzany wyłącznie w pamięci i w katalogu tymczasowym żądania; nic nie jest zapisywane na stałe.
Nagłówek `X-Extractor` mówi, która ścieżka wygenerowała wynik (`LlmExtractor` lub `HeuristicExtractor` po awarii modelu). `X-Partial-Result: true` oznacza, że wynik może nie zawierać całego źródła; `X-Partial-Reasons` podaje przyczyny rozdzielone `; `: `chunk-skipped:<strony>` (fragment pominięty po nieudanych próbach), `llm-truncated:<schemat>` (użyta odpowiedź modelu ucięta na limicie tokenów), `extractor-fallback:<błąd>` (przejście na `HeuristicExtractor`). Każda przyczyna zwiększa `X-Warnings` o 1.

## Pomiary (stan 22.11)

| Co | Gdzie | Wynik |
|---|---|---|
| Wymagania Docker i API end-to-end (`scripts/verify_stack.sh`, 14 kontroli), develop `d3f0b65` (22.11 08:40) | x86 (i7-9750H, 12 vCPU), bez GPU | 14/14; analiza formularza 05 przez lokalny model 85 s (poprzednie przebiegi na starszym kodzie: 98–232 s) |
| Golden 01 i 05 vs JSON COI (`src/formgen/eval/metric.py`, wyniki z `data/output/`, kod `d3f0b65`) | GPU (GTX 1660 Ti, llama.cpp CUDA) | composite 0,925 / 0,919; recall 0,96 / 0,93; F1 0,86 / 0,84; F1 samego przedmiotu wniosku 0,75 / 0,50; 29 s / 37 s |
| SCORE harnessu na 4 formularzach smoke (01, 04, 05, 09), `make eval-warm`, develop 22.11 | cache odpowiedzi modelu | 0,753 w ok. 20 s (szum między próbkami modelu ok. 0,017) |
| Rozmiar modelu na samym CPU (`docs/08-implementacja/research/ab-models-cpu.md`) | x86, 6 rdzeni | 0,8B / 2B / 4B: composite 0,89–0,93; prosty formularz 302 / 74 / 242 s |
| Qwen3.5-4B Q4, generacja | M4 Metal / GTX 1660 Ti / CPU x86 | 12 / 59 / ok. 11 tok/s |
| 9 formularzy do oddania (`data/output/`, kod `d3f0b65`, `LLM_FALLBACK_HEURISTIC=false`) | GPU, 2 formularze naraz | 0 błędów reguł w 9/9; 29–300 s na formularz (najdłużej 08 i 09) |
| Formularz 08 (6 stron, 136 pól) na samym CPU | x86 | brak pomiaru na kodzie z `main`; jeden pomiar z 22.11 z dodatkową, nieumergowaną zmianą (#55): 1142 s |
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
