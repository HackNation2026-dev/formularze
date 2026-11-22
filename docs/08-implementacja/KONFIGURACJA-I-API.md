---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: instrukcja techniczna i zachowane pomiary
---

# Konfiguracja, API i pomiary

Główna ścieżka uruchomienia: [README](../../README.md#uruchomienie).
Poniżej szczegóły przeniesione z README; nie są nowym wynikiem ewaluacji.

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

OpenAPI: `GET /docs`, `GET /openapi.json`. Obsłużone błędy aplikacji jako `{"error": {"code", "message", "details"}}`.

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

Zapis historycznych prób z wcześniejszego README, bez ich ponownego wykonania.
To różne wersje i warunki uruchomienia; tabela nie jest kontrolowanym porównaniem.
Walidacja techniczna i F1 nie potwierdzają kompletności treści ani importu COI.


| Co | Gdzie | Wynik |
|---|---|---|
| Wymagania Docker i API end-to-end (`scripts/verify_stack.sh`, 14 kontroli), develop `d3f0b65` (22.11 08:40) | x86 (i7-9750H, 12 vCPU), bez GPU | 14/14; analiza formularza 05 przez lokalny model 85 s (poprzednie przebiegi na starszym kodzie: 98–232 s) |
| Golden 01 i 05 vs JSON COI (`src/formgen/eval/metric.py`, wyniki z `data/output/`, kod `d3f0b65`) | GPU (GTX 1660 Ti, llama.cpp CUDA) | composite 0,925 / 0,919; recall 0,96 / 0,93; F1 0,86 / 0,84; F1 samego przedmiotu wniosku 0,75 / 0,50; 29 s / 37 s |
| SCORE harnessu na 4 formularzach smoke (01, 04, 05, 09), `make eval-warm`, develop 22.11 | cache odpowiedzi modelu | 0,753 w ok. 20 s (szum między próbkami modelu ok. 0,017) |
| Rozmiar modelu na samym CPU (`docs/08-implementacja/research/ab-models-cpu.md`) | x86, 6 rdzeni | 0,8B / 2B / 4B: composite 0,89–0,93; prosty formularz 302 / 74 / 242 s |
| Qwen3.5-4B Q4, generacja | M4 Metal / GTX 1660 Ti / CPU x86 | 12 / 59 / ok. 11 tok/s |
| 9 formularzy do oddania (`data/output/`, kod `d3f0b65`, `LLM_FALLBACK_HEURISTIC=false`) | GPU, 2 formularze naraz | 0 błędów reguł w 9/9; 29–300 s na formularz (najdłużej 08 i 09) |
| Formularz 08 (6 stron, 136 pól) na samym CPU | x86 | brak pomiaru na kodzie z `main`; jeden pomiar z 22.11 z dodatkową, nieumergowaną zmianą (#55): 1142 s |
| Tryb bez modelu (`EXTRACTOR=heuristic`) | – | wynik zależy od odczytu i reguł; przedmiot wniosku słabszy |

Szczegóły: `docs/08-implementacja/research/` (badania i pomiary), `docs/08-implementacja/DEMO-SETUP.md` (ustawienie na obronę).


## Własny endpoint GPU

Serwer Qwen na własnym GPU jest zasobem zespołu. Nie należy utożsamiać go
z zewnętrznym dostawcą modeli tylko dlatego, że oba udostępniają HTTP API.
Przykładowy serwer zespołu uruchamia [serve_gpu.sh](../../scripts/legion/serve_gpu.sh).
Instalacja GPU, sterowników i tunelu należy do przygotowania tej maszyny.
Treść dokumentu jest wysyłana z aplikacji do wskazanego endpointu.

W `.env` ustaw rzeczywisty `LLM_BASE_URL` bez końcówki `/v1`, `LLM_MODEL`
i ewentualny `LLM_API_KEY`. Opcjonalnie ustaw
`LLM_FALLBACK_BASE_URL=http://llm:8080` i `LLM_FALLBACK_MODEL=qwen3.5-4b`.
Klucza nie zapisuj w repozytorium. Model musi być otwarty i możliwy do
samodzielnego uruchomienia, zgodnie z ustaleniem mentora.

**Ważne:** `compose.yaml` nadpisuje `LLM_BASE_URL` z `.env` adresem kontenera CPU.
Aby użyć własnego endpointu bez zmian aplikacji, utwórz lokalny override:

```sh
cat > compose.endpoint.yaml <<'YAML'
services:
  api:
    environment:
      LLM_BASE_URL: ${LLM_BASE_URL:?Ustaw adres własnego endpointu w .env}
YAML
docker compose -f compose.yaml -f compose.endpoint.yaml up -d --build
```

Pozostałe zmienne w `.env` trafiają do API przez `env_file`. Kontener `llm`
zostaje lokalnym zapasem CPU. Przy kolejnych komendach Compose używaj obu plików.
`LLM_FALLBACK_HEURISTIC=false` wyłącza heurystykę, nie skonfigurowany zapasowy
endpoint LLM. Gdy potrzebujesz dowodu użycia konkretnego GPU, sprawdź także
logi endpointu; `X-Extractor: LlmExtractor` nie identyfikuje maszyny.

Przejście na model zapasowy lub heurystykę jest próbą odzyskania wyniku, nie
gwarancją sukcesu. Opis starego ustawienia demonstracyjnego i historyczne
czasy zachowano w [DEMO-SETUP](DEMO-SETUP.md).

## Rozwój i ewaluacja

Wymagania hostowe: Python 3.14+, Tesseract z językiem `pol`, llama.cpp,
a dla `/review/` Node.js 22.3+/npm. Przygotuj materiały i model według README.
Cel `make venv` ma ścieżkę Homebrew; jeśli Python jest w PATH, użyj:

```sh
python3.14 -m venv .venv
.venv/bin/pip install -e ".[dev]"
npm ci
npm run ui:assets
```

W `.env` ustaw `LLM_BASE_URL=http://127.0.0.1:8080`. W jednym terminalu uruchom
`make llm`, w drugim `.venv/bin/python -m formgen`. Dla binarnego DOC potrzebna
jest dodatkowo Tika i właściwy `DOC_CONVERTER_URL`. `make run` jawnie wyłącza JWT;
bezpośrednie uruchomienie Pythona zachowuje konfigurację `.env`.
Token na hoście: `TOKEN="$(.venv/bin/python scripts/make_token.py)"`.
Skrypt nie jest kopiowany do obrazu Docker, dlatego główne README wywołuje
funkcję `issue_token` w kontenerze.

`make test`, `make lint`, `npm run check:ui` i `npm run test:ui` kontrolują kod
i interfejs. Testy UI wymagają Chrome. Aplikacja [apps/web](../../apps/web/README.md)
ma własne środowisko i testy, niezależne od statycznego `/review/`.

Harness `scripts/eval_suite.py` liczy zgodność z referencjami 01/05, spójność
między formatami, pokrycie linii z miejscem na dane i szum. SCORE łączy te
wskaźniki; nie zastępuje oceny treści przez urzędnika.

- `make eval-warm`: smoke 01/04/05/09 z cache odpowiedzi modelu; nie mierzy czasu generacji.
- `scripts/eval_fast.sh --cold`: uzupełnia cache przez rzeczywisty model.
- `make eval-full`: wszystkie dziewięć formularzy, z rzeczywistymi wywołaniami.
- `make e2e` i `make batch`: pojedyncza referencja lub generacja do `data/output/`.

Cache `LLM_CACHE_DIR` służy wyłącznie ewaluacji; nie ustawiaj go w produkcji,
bo utrwala dane. Szczegóły pracy zespołu: [PLAN-ZESPOL](PLAN-ZESPOL.md).
Katalog modułów: [MODULY](MODULY.md). Plik `.doc` rozpoznany jako DOCX jest
celowo przetwarzany według zawartości, jak w próbkach organizatora.
