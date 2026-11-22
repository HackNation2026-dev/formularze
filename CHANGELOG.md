# Historia zmian

## Niewydane

- Aplikacja GUI `apps/web/` (ADR-002): Next.js 16, React 19, TypeScript, TanStack Query/Table/Form, next-intl PL/EN, Tailwind v4 z tokenami, atomic design system z katalogiem `/design-system`, wszystkie podstawowe widoki (logowanie, upload z kolejką, wynik JSON, walidacja, podgląd e-usługi ze stanami JSONata, otwórz JSON, ustawienia, stany błędów), mock API (MSW), 324 testy jednostkowe i 28 e2e, workflow CI `web.yml`. Spec i plan w `docs/superpowers/`, lista zadań na kolejny etap w `docs/08-implementacja/GUI-DO-ZROBIENIA.md`.
- Walidatory PL (`schema/validators.py`) i `sample_values` w `POST /api/v1/forms/validate` (#3).
- Propozycja 3 nowych słowników: dyscypliny sportowe, rasy psów, podatki i opłaty lokalne (#4); wynik formularza 09 z pełną listą dyscyplin (#5).
- Otwarty model w chmurze przez API z lokalnym zapasem: `LLM_API_KEY`, `LLM_FALLBACK_BASE_URL`, `scripts/legion/serve_gpu.sh`, `docs/08-implementacja/DEMO-SETUP.md` (#6).
- Cache prefiksu promptu na CPU i pomiar rozmiaru modelu na samym CPU (#7); timeout wywołania modelu 600 s, żądania 1800 s; 9 JSON-ów z aktualnego kodu (#9).
- Ewaluacja: cache odpowiedzi modelu `LLM_CACHE_DIR`, równoległy `batch.py`, 4 sloty po 8k na serwerze GPU (#14); `scripts/eval_suite.py` i `scripts/eval_fast.sh`, `make eval-warm` / `eval-full` (#15).
- CI uruchamia testy, ruff i sync materiałów na każdym push i PR; `main` i `develop` chronione.
- Dodano interfejs przeglądu `/review/` (pkt 3.3 IV i V): podgląd PDF obok wszystkich pól, symulacja warunków JSONata w izolowanym workerze, uwagi i zgłoszenia braków, eksport czystego JSON i osobnego raportu. 13 testów Playwright.
- Dockerfile ma etap `node:22.23.1-alpine3.24`, który buduje przypięte zasoby UI. `pyproject.toml` pakuje UI, `verify_docs.py` pomija `node_modules`.
- Dodano makiety GUI (FigCraft): projekt i plan w `docs/superpowers/`, opis w `docs/08-implementacja/GUI-MAKIETY.md`, tokeny `design/tokens.css` i `design/tokens.json` (generator `scripts/gui_tokens_from_css.py`) oraz testy kontrastu WCAG i spójności tokenów `tests/test_gui_tokens.py`. Plik `.figcraft` nie jest w Git (silnik FigCraft nie zapisuje do repo).

## 0.4.0 — 2026-11-21

- Dodano aplikację (`src/formgen`): REST API FastAPI z pełną walidacją uploadu (nazwa, rozszerzenie, rozmiar, MIME przez magika, JWT), model `FormDefinition` zgodny z JSON-ami referencyjnymi COI, walidator reguł technicznych i lint JSONata, deterministyczny kompilator szablonów (strona Dane, kontakt, FINISH, adresy, zależności), parsery PDF/DOCX/XLSX/ODS/DOC/obrazów, ekstraktor LLM (llama.cpp, gramatyka JSON) i ekstraktor heurystyczny jako fallback.
- Dodano Dockerfile (python:3.14.4-slim-trixie, non-root), compose z sidecarami llama.cpp i Apache Tika, Makefile, skrypty `run_e2e.py`, `batch.py`, `sync_materials.py`, `make_token.py`.
- Dodano 82 testy: round-trip obu JSON-ów referencyjnych, reguły, kompilator vs golden (F1 0.97), API, ingest, ekstrakcja.
- Dodano wygenerowane JSON-y dla 7 formularzy do oceny (`data/output/`) oraz dokumentację implementacji (`docs/08-implementacja/`): PROBLEM, SPEC, analiza materiałów, research (LLM, OCR, prior art, Generator Formularzy, gdzie uruchomić), pomiary, licencje zależności, mapowanie boardu Miro.
- Materiały organizatora bez zmian; `data/input/` to kopie robocze poza Git.

## 0.3.0 — 2026-11-21

- Odnotowano zmianę widoczności repo na publiczną przez użytkownika; skrypt publikacji prywatnej nie jest używany dla tego wydania.
- Dodano `docs/04-architektura/proponowany-stos.md` ze statusem PROPONOWANY (nie decyzja): Python 3.14 + FastAPI, Tika + Tesseract, kompilator JSON COI, llama.cpp, React/TS, Docker Compose.
- Uzupełniono ADR-001, architekturę i konsultację Fable o odnośniki i uwagę dotyczącą GUI.
- Przywrócono jako sekcje historyczne treść nadpisaną w 0.2.0 (status publikacji, status konsultacji, dawną organizację).
- Zmiany wyłącznie addytywne; materiały organizatora bez zmian.

## 0.2.0 — 2026-11-21

- Opublikowano prywatne repo `HackNation2026-dev/formularze` (organizację utworzył użytkownik ręcznie); potwierdzono prywatność, SHA i drzewo.
- Dodano wynik niezależnej konsultacji Fable (`claude-fable-5-2`, bezpośrednie CLI): surowa odpowiedź, zlecenie i metadane.
- Rekomendacja Fable dla COI: Python 3.14 + FastAPI, Tika/Tesseract, LLM lokalny przez llama.cpp z kompilatorem JSON COI, React/TS, bez Rusta. To nie jest decyzja zespołu; ADR-001 pozostaje propozycją.
- Poprawiono nieaktualną wersję i organizację w `docs/README.md`. Materiały organizatora bez zmian.

## 0.1.1 — 2026-11-21

- Zmieniono organizację docelową na `HackNation2026-dev` zgodnie z poleceniem użytkownika.
- Dodano porównanie pełnej aplikacji: CLI/API, Python/Rust, React/TypeScript i egui.
- Konsultacja Fable nie została wykonana; propozycja stosu jest oceną autora.
- Publikacja nadal wymaga działającego dostępu do GitHub. Materiały organizatorów pozostają bez zmian.

## 0.1.0 — 2026-11-21

- Utworzono wersjonowaną dokumentację w podziale na osiem obszarów.
- Dodano oryginalne opisy, regulaminy i dostępne materiały organizatora.
- Rozdzielono wymagania, propozycję stosu, testy, prezentację i pytania.
- Dodano rejestr źródeł, sumy kontrolne i kontrolę odnośników.
- Nie zaimplementowano jeszcze aplikacji konkursowej.
