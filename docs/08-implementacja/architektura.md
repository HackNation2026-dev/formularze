---
wersja: 0.4.0
aktualizacja: 2026-11-22
status: implementacja — opis zgodny z kodem na gałęzi develop
---

# Architektura (stan kodu, 2026-11-22)

Ten plik jest jedynym autorytatywnym opisem działającej aplikacji. Każde pudełko na schemacie ma obok ścieżkę do
modułu w `src/formgen/`; propozycje sprzed implementacji (React/TypeScript, Rust, Tika jako czytnik wszystkich
formatów) leżą w `docs/04-architektura/` i są oznaczone jako historyczne.

## Schemat potoku

```text
 klient (curl, UI /review/, scripts/batch.py)
   │  POST /api/v1/forms/analyze  (multipart, pole `file`)        api/app.py
   │  POST /api/v1/forms/analyze-batch (pole `files`, po kolei)    api/app.py
   ▼
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 1. API + walidacja wejścia                                   src/formgen/api/          │
│    JWT Bearer (wyłączalne AUTH_ENABLED)                      api/security.py           │
│    nazwa -> rozszerzenie -> rozmiar (strumień, 1 MB porcje)   api/upload.py             │
│    -> zgodność treści z rozszerzeniem: Google magika          ingest/detect.py          │
│    plik tylko w pamięci (bytes); brak katalogu tymczasowego, brak dysku                 │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       ▼  pipeline.run(data, kind, filename, settings)   src/formgen/pipeline.py
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 2. INGEST  bajty -> Document (strony, linie, `____`, `☐`, tabele)   src/formgen/ingest/ │
│    PDF z warstwą tekstu: pdfplumber (+ prostokąty kratek)      ingest/pdf.py            │
│    PDF-skan / strona < 50 znaków: pypdfium2 -> OCR             ingest/pdf_raster.py     │
│    DOCX: python-docx (akapity, tabele, pola tekstowe)          ingest/office.py         │
│    XLSX: openpyxl / ODS: odfpy; dolna krawędź komórki -> `____`,                        │
│      wiersze pod „etykietą:” -> opcje `☐` (_mark_choice_rows)   ingest/office.py         │
│    DOC: Apache Tika (sidecar, DOC_CONVERTER_URL) -> bez Tiki: zgrubny odczyt tekstu     │
│    JPG/PNG: cięcie sklejonych stron A4 -> Tesseract `pol` per strona   ingest/image.py  │
│    model dokumentu: Document / Page / Line / Table              ingest/model.py         │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       ▼  Document.to_prompt_text()
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 3. EXTRACT  Document -> FormSpec (tylko przedmiot wniosku)   src/formgen/extract/      │
│    EXTRACTOR=llm (domyślnie)                                  extract/extractor.py      │
│      • 1 call globalny (tytuł, urząd, kto wnioskuje)  schemat LlmGlobal  extract/schema.py │
│      • 1 call na chunk ≤ 4500 znaków (sekcje/pola)    schemat LlmChunk                 │
│      • wywołania równolegle: LLM_PARALLEL (domyślnie 2, ThreadPoolExecutor)             │
│      • budżet odpowiedzi = LLM_CONTEXT_TOKENS − prompt; < 1024 tokenów -> chunk dzielony │
│        na połówki (max 2 poziomy), ucięty/zepsuty JSON -> retry na połówkach -> skip    │
│      • prompty PL                                             extract/prompts.py        │
│      • klient OpenAI-compatible, gramatyka JSON-schema          extract/llm_client.py    │
│        (`response_format: json_schema`, przy odmowie dostawcy `json_object` + schemat   │
│        w prompcie); łańcuch LLM_BASE_URL -> LLM_FALLBACK_BASE_URL (ChainedClient);      │
│        LLM_CACHE_DIR = cache odpowiedzi tylko do ewaluacji                              │
│      • warm-up: LLM_WARM_UP=true prefilluje wspólny prefiks promptów po starcie API     │
│    EXTRACTOR=heuristic / fallback po ConnectionError, TimeoutError, ValueError           │
│      (LLM_FALLBACK_HEURISTIC=true): nagłówki, `☐`, `____`, słowa kluczowe  extract/heuristic.py │
│    EXTRACTOR=stub: sam szablon                                 pipeline.py (StubExtractor) │
│    to_spec(): grounding etykiet w tekście (rapidfuzz ≥ 60), odrzucenie pól szablonowych │
│      i sekcji-szumu, scalanie duplikatów, słowniki COI (dictionary_for -> SELECT),      │
│      słowniki PROPONOWANE (with_proposed: opcje inline + tooltip), walidatory,          │
│      warunki widoczności, dodatkowe zgody                      extract/extractor.py     │
│    wynik częściowy: partial_reasons (chunk-skipped, llm-truncated, extractor-fallback)   │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       ▼  FormSpec                        compose/spec.py
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 4. COMPOSE  FormSpec -> FormDefinition (deterministycznie)   src/formgen/compose/      │
│    strona „Dane” (MAIN): urząd/organ, w czyim imieniu (Swoim / Innej osoby / Osoby      │
│      prawnej), Twoje dane (MLPZ lub PESEL), adres zamieszkania, dane podmiotu + adres    │
│      siedziby + reprezentant, dane innej osoby + jej adres, pełnomocnictwo, opłata      │
│      skarbowa                                                 compose/templates.py      │
│    strony 2..n: przedmiot wniosku z FormSpec; techName ze slugów (unikalne),            │
│      JSONata SHOW z `visible_when`, wykrywanie cykli widoczności, REPEATING_SECTION      │
│                                                              compose/assemble.py       │
│    strona kontaktu (MAIN): dane do kontaktu (e-mail z MLPZ) + zgody   compose/templates.py │
│    „Strona końcowa” (FINISH): podgląd i podsumowanie          compose/templates.py      │
│    flow: łańcuch linków między zakładkami w kolejności        compose/assemble.py       │
│    pomocnicze: siatka x/y/rows/cols, UUID, HTML opisów       compose/builders.py       │
│      zapytania JSONata                                        compose/jsonata.py        │
│      slugi techName                                           compose/slug.py          │
│      słowniki COI + PROPONOWANE                               compose/dictionaries.py  │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       ▼  FormDefinition                  schema/model.py
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 5. SCHEMA  model pydantic + reguły techniczne COI             src/formgen/schema/      │
│    check_rules(): tytuł, ≥ 2 zakładki, ostatnia FINISH, flow, siatka, słowniki tylko   │
│      na SELECT, ... -> lista naruszeń (error / warning)       schema/rules.py           │
│    lint JSONata: składnia, odwołania do istniejących pól, cykle SHOW   schema/jsonata_lint.py │
│    walidatory wartości: PESEL, NIP, REGON, dowód, kod pocztowy, ePUAP, ADE, e-mail,     │
│      REQUIRED (`sample_values` w /validate)                    schema/validators.py     │
│    nazwy słowników COI                                        schema/dictionaries.py   │
│    błąd reguł => HTTP 500 INVALID_OUTPUT: API nigdy nie zwraca niepoprawnego JSON-a     │
└──────────────────────────────────────┬────────────────────────────────────────────────┘
                                       ▼
 200 FormDefinition + nagłówki X-Processing-Time-Ms, X-Detected-Type, X-Warnings,
 X-Extractor (LlmExtractor | HeuristicExtractor), X-Partial-Result, X-Partial-Reasons    api/app.py

 obok potoku:
   POST /api/v1/forms/validate   FormDefinition (+ sample_values) -> valid/errors/warnings   api/app.py -> schema/
   GET  /api/v1/formats, /health, /ready (pyta LLM: degraded / 503)                         api/app.py
   GET  /review/                 UI przeglądu: PDF obok pól, symulacja JSONata, eksport     static/review/ (ES modules, bez frameworka)
   GUI apps/web (osobny proces)  Next.js nad tym samym REST API; poza obrazem Docker api    apps/web/ (npm run dev, :3000)
   ewaluacja                     metryka vs JSON wzorcowy (F1 pól, typy, SHOW)              eval/metric.py
                                 harness 9 formularzy × formaty, cache odpowiedzi           scripts/eval_suite.py, scripts/eval_fast.sh
   generowanie wyników           data/output/*.json dla formularzy do oceny                scripts/batch.py
```

Kierunek importów (kontrakt `import-linter` w `pyproject.toml`, sprawdzany w CI):
`api > pipeline > extract > (compose | ingest) > schema > config`; `eval` czyta tylko `schema`.

## Zasady

- Model generuje tylko to, czego nie da się wyliczyć: przedmiot wniosku, typy pól, opcje, zależności. Reszta
  (strony szablonowe, adresy, pełnomocnictwo, opłata, kontakt, zgody, strona końcowa, flow, siatka, UUID) to kod.
- Composer odtwarza strony szablonowe obu JSON-ów wzorcowych COI (test w `tests/unit/test_compose.py`,
  składowa composite w `tests/unit/test_golden.py`).
- Ekstraktor nigdy nie zawodzi użytkownika: awaria, timeout lub niepoprawna odpowiedź LLM przełączają na
  `HeuristicExtractor`, a ubytek treści jest jawny w `X-Partial-Result` / `X-Partial-Reasons` (zamiast cichej
  niekompletności).
- Plik wejściowy istnieje tylko jako `bytes` w pamięci procesu na czas żądania; brak dysku, bazy i kolejki.

## Dostarczenie (compose.yaml, Dockerfile)

| Usługa | Obraz | Rola | Sieć / uprawnienia |
|---|---|---|---|
| `api` | `python:3.14.4-slim-trixie` + `tesseract-ocr`, `tesseract-ocr-pol`; etap `node:22.23.1-alpine3.24` buduje zasoby UI (PDF.js, JSONata) z `package-lock.json` | FastAPI, `python -m formgen`, uid 1000 | jedyny port (`APP_PORT`, 8000); sieci `edge` + `backend`; `read_only`, `tmpfs /tmp`, `cap_drop ALL`, `no-new-privileges` |
| `llm` | `ghcr.io/ggml-org/llama.cpp:server-b12602` (CPU) | `Qwen3.5-4B-Q4_K_M.gguf` z `./models` (ro), `--ctx-size 16384`, `--temp 0`, `-b 256 -ub 256 --checkpoint-min-step 256` (cache prefiksu dla modelu hybrydowego) | tylko `backend` (`internal: true`, bez trasy do Internetu) |
| `tika` | `apache/tika:3.3.0.0` | `.doc` -> tekst | tylko `backend` |

Compose ustawia `LLM_WARM_UP=true`. Wagi modelu nie są w obrazie (`make models` pobiera je do `./models`).
Nie ma osobnego sidecara OCR ani pliku `compose.gpu.yaml`: OCR to Tesseract wewnątrz obrazu `api`, GPU uruchamia
się przez zewnętrzny endpoint tego samego otwartego modelu (`LLM_BASE_URL` + `LLM_API_KEY`, zapas
`LLM_FALLBACK_BASE_URL` = lokalny `llm`). `scripts/verify_stack.sh` sprawdza 14 warunków (zdrowie, non-root,
read-only, jeden port, sieć wewnętrzna bez Internetu, brak `:latest`, brak sekretów w obrazie, 401, 415, 200 z
`X-Extractor: LlmExtractor`, wynik przechodzi `/validate`, obraz działa z `--network none` w trybie `heuristic`).

## Konfiguracja

Pełna tabela zmiennych: `README.md`, sekcja „Konfiguracja” (źródło: `src/formgen/config.py`). Zmienne istotne dla
tego schematu: `EXTRACTOR`, `LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY`, `LLM_FALLBACK_BASE_URL`/`LLM_FALLBACK_MODEL`,
`LLM_FALLBACK_HEURISTIC`, `LLM_TIMEOUT_SECONDS` (600), `LLM_CONTEXT_TOKENS` (8192), `LLM_PARALLEL` (2),
`LLM_WARM_UP`, `LLM_CACHE_DIR`, `DOC_CONVERTER_URL`, `WITH_VALIDATORS`/`WITH_DICTIONARIES`/`WITH_DEPENDENCIES`,
`REQUEST_TIMEOUT_SECONDS` (1800), `MAX_BATCH_FILES` (20). `OCR_BACKEND` i `OCR_BASE_URL` są w `Settings`, ale
kod OCR używa wyłącznie Tesseracta; inne wartości nie zmieniają działania.

## Co zmieniło się względem opisu z 21.11

- Tesseract jest jedynym backendem OCR (brak rapidocr / Unlimited-OCR w kodzie).
- Osobny krok „enrich” nie istnieje jako moduł: grounding, słowniki, walidatory i warunki są w
  `extract/extractor.py::to_spec`, wspólne dla ekstraktora LLM i heurystycznego.
- Wywołania LLM jednego formularza biegną równolegle (`LLM_PARALLEL`), odpowiedź ma budżet liczony z
  `LLM_CONTEXT_TOKENS` zamiast stałego `max_tokens`, a API prefilluje prefiks promptów po starcie (`LLM_WARM_UP`).
- Słowniki proponowane (`PROPOSED` w `compose/dictionaries.py`, opis w `NOWE-SLOWNIKI.md`) wchodzą do pól jako
  opcje inline z tooltipem, bo Generator COI ich jeszcze nie zna.
- `/ready` raportuje `degraded`, gdy działa tylko fallback heurystyczny; `503`, gdy fallback wyłączony.
- Proces: `develop` (praca) i `main` (stan na obronę), obie chronione: PR i zielone `tests` + `docs`.
