---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

> Dokument historyczny: stan na 21.11, 15:40. Aktualny stan: `architektura.md` (sekcja „Zmiany po 21.11”) i `README.md`.

# Miro „HackNation 2026: architektura” vs stan repo (2026-11-21 15:40)

Źródło: `HackNation 2026_ architektura-miro.pdf` (eksport boardu). Dotyczy części **COI**. Część UZP (Odwołania2JSON) to inne zadanie, pomijam.

## COI: kolejność budowy (board) -> status

| # | Board | Status | Gdzie |
|---|---|---|---|
| 1 | IR, kompilator i walidator na dwóch referencjach | **done** | `compose/spec.py` (IR = `FormSpec`), `compose/assemble.py` (kompilator), `schema/rules.py` + `jsonata_lint.py`; testy golden F1 0.97 |
| 2 | Szkielet REST: walidacja pliku, tmp, JWT, Docker non-root | **done** | `api/`, `Dockerfile`, `compose.yaml`; 73 testy |
| 3 | Adaptery 8 formatów na 9 formularzach | **done (7/8)** | `ingest/`: pdf, docx (także PDF->DOCX z text boxami), xlsx, ods, jpg/png (Tesseract), skan PDF; `.doc` przez Tika **niezweryfikowany** (Docker na Macu nie działa) |
| 4 | Ekstraktor heurystyczny bez LLM | **todo** | dziś tylko `StubExtractor` (szablon bez przedmiotu wniosku); buduję `HeuristicExtractor` jako tryb awaryjny |
| 5 | Kontener LLM z gramatyką | **done** (model inny) | `extract/llm_client.py` -> llama.cpp JSON-schema grammar; compose `llm` sidecar; model: Qwen3.5-4B (board: Bielik 4.5B) – A/B czeka na dysk/Legion |
| 6 | Słowniki, dane inicjalne, walidatory PESEL/NIP/REGON | **częściowo** | słowniki Kraje/TERYT i dane MLPZ/PESEL w szablonach; walidatory jako nazwy w `validation`; brak własnej implementacji sum kontrolnych (jest w `docs/research/spikes/03_validators_check.py`), brak „propozycji nowego słownika” |
| 7 | Zależności i JSONata | **done** | generator w `compose/jsonata.py`, `visible_when` z LLM -> `states[SHOW]`, lint cross-ref |
| 8 | GUI: upload, JSON, renderer e-usługi | **zespół** | brief `docs/FRONTEND-BRIEF.md`, `static/vendor/jsonata.min.js` |
| 9 | Test offline, README, prezentacja, film | **częściowo** | README wg R-17 jest; test `--network none`, prezentacja, film: todo |

## COI: zasady architektury (board) -> status
- Granica sieci: api/tika/llm w sieci internal, jeden port publiczny – **done** w compose (sidecary tylko `expose`). Test bez Internetu – todo.
- Pliki tymczasowe: katalog per żądanie w tmpfs, `finally` – **done** (`TemporaryDirectory` + `tmpfs: /tmp` w compose, `read_only: true`).
- IR jako kontrakt, testy na dwóch referencjach – **done** (`FormSpec`, `test_compose.py`). Wersjonowanie IR: todo (pole `version`).
- Walidacja dwuetapowa (schemat, potem reguły) – **done** (pydantic -> `check_rules`).
- Pętla naprawy (błędy walidatora -> kompilator, max 2 rundy) – **todo**; dziś błąd = 500 `INVALID_OUTPUT`. Kompilator jest deterministyczny, więc błędy są rzadkie, ale pętla dla jsonata/duplikatów jest tania.

## COI: stos (board) -> różnice
- Model: board Bielik 4.5B Q4 (opcja 11B). Repo: Qwen3.5-4B Q4 (rekomendacja researchu). Pomiar na M4: 12 tok/s, formularz 1-str. ≈ 65–100 s. **Decyzja po A/B z Bielikiem** (pobranie nie zmieściło się na dysku Maca, robię na Legionie).
- Odczyt: board „Tika dla 8 formatów + Tesseract”. Repo: natywne parsery (pdfplumber, python-docx, openpyxl) z układem i kratkami, Tika tylko dla `.doc`. Natywne dają pozycje i ☐, Tika tylko tekst. Zostawiam natywne, Tika jako fallback.
- GUI: board React/TS. Brief zakłada vanilla JS bez build stepu; React/TS OK, jeśli dist trafi do repo (offline, bez CDN).
- Dostarczenie: „obrazy z digestem” – todo (dziś tagi; dodać `@sha256:`).

## COI: do zatwierdzenia (board) -> moje odpowiedzi
- Sprzęt jury (C-Q07): nieznany. Plan z researchu: demo na M4 natywnie (Metal) + backup RunPod A5000; 11B tylko z GPU.
- Pliki .doc: Tika wystarcza (Apache-2.0); LibreOffice tylko po zgodzie mentora. Uwaga: `.DOC` organizatora to w środku DOCX, obsłużone.
- Pisownia kontraktu: goldeny używają `repeatingSectionGrid` i `MAIN`/`FINISH` – trzymamy się goldenów (schema ma literówkę).
- Oficjalne obrazy: używamy `apache/tika:3.3.0.0` (oficjalny), nie własnego na temurin.
- Python czy Java: Python 3.14, potwierdzone (cały pipeline już w Pythonie).

## Wspólne zasady (board) -> status
- „LLM proponuje, kod decyduje” – dokładnie tak działa: model daje płaski IR, kompilator buduje i waliduje. Grounding odrzuca pola bez pokrycia w tekście.
- „Jeden silnik, wiele wejść” – `pipeline.run()` wspólny dla REST, `scripts/run_e2e.py`, `scripts/batch.py`.
- „Transparentność: każde pole niesie dowód” – **todo**: dodać do wyniku (poza JSON-em COI) `evidence` per pole: strona + fragment tekstu, do GUI.
