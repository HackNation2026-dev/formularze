---
wersja: 0.5.0
aktualizacja: 2026-11-22
status: implementacja
---

# Cyfryzacja formularzy (COI) – checklista wymagań

Źródło: `docs/zadanie.txt` (pełna treść zadania, HackNation 2026). Nagroda: 25 000 zł (1 nagroda).

## Cel
Usługa AI: plik formularza (PDF/DOC/DOCX/ODS/XLSX/JPG/JPEG/PNG) -> JSON ze strukturą formularza
elektronicznego, zgodny ze schematem oczekiwanym przez aplikację COI (Generator Formularzy / AI HUB / Multiportal).
Użytkownik docelowy: urzędnik cyfryzujący formularze e-usług.

Stan na 22.11. Pole zaznaczone tylko tam, gdzie wskazujemy kod albo test. Mapowanie R-xx -> kod: [SPEC.md](SPEC.md).

## Zakres minimalny (obowiązkowy)
- [x] REST API: upload pojedynczego pliku formularza -> JSON — `POST /api/v1/forms/analyze` (`src/formgen/api/app.py`), `tests/api/test_analyze.py`
- [x] JSON odpowiada zawartości formularza (dane z pkt 3.1.II) — 9 wyników w `data/output/`; golden 01 / 05: recall 0,96 / 0,93 (`src/formgen/eval/metric.py`)
- [x] JSON zgodny ze strukturą oczekiwaną przez aplikację (wzór: pliki JSON z pkt 3.1.I) — model `FormDefinition` (`src/formgen/schema/model.py`), round-trip wzorców w `tests/unit/test_golden.py`
- [x] JSON spełnia wymagania projektowania formularzy (np. podział na strony tematyczne – pkt 3.1.III) — `src/formgen/schema/rules.py`, szablony `src/formgen/compose/templates.py`; 0 błędów reguł w 9/9 wynikach
- [x] Dokumentacja architektury rozwiązania — [architektura.md](architektura.md)

## Rozszerzenia (dodatkowo punktowane – kolejność z kryteriów oceny)
- [x] I. Powiązanie pól ze słownikami i danymi inicjalnymi z bazy wejściowej — `src/formgen/schema/dictionaries.py`, `src/formgen/compose/dictionaries.py`
- [x] II. Propozycja nowego słownika, gdy brak pasującego — `PROPOSED` w `src/formgen/compose/dictionaries.py`, [NOWE-SLOWNIKI.md](NOWE-SLOWNIKI.md)
- [x] III. Zależności / dynamiczne przepływy między polami, sekcjami, stronami (warunki widoczności) — `src/formgen/compose/jsonata.py`, `src/formgen/schema/jsonata_lint.py`
- [x] IV. Prosty frontend: upload plików + podgląd JSON — `/review/` (`src/formgen/static/review/`), `tests/ui/review.spec.cjs`
- [x] V. Aplikacja wizualizująca JSON jako formularz eUsługi (render) — symulacja w `/review/`, [UI-PRZEGLAD.md](UI-PRZEGLAD.md)
- [x] VI. Walidacje pól (typ, długość, PESEL, telefon, …), UX (batch, makiety) — `src/formgen/schema/validators.py`, `tests/unit/test_validators.py`, `POST /api/v1/forms/analyze-batch`

## Wymagania techniczne (twarde)
- [x] Język: Python >= 3.14 (mamy `/opt/homebrew/bin/python3.14`, 3.14.4) lub Java >= 21 — `requires-python = ">=3.14"` w `pyproject.toml`, obraz `python:3.14.4-slim-trixie`
- [x] Tylko open source, BEZ copyleft (AGPL, GPL zakazane). Uwaga na: PyMuPDF (AGPL), Ghostscript (AGPL), unoconv (GPL), odfpy (GPL/Apache dual – OK pod Apache) — spis: [LICENSES.md](LICENSES.md)
- [x] BEZ zewnętrznych API / MCP / SaaS w runtime. BEZ LLM dostępnych tylko przez API (OpenAI/Anthropic/Gemini). Modele lokalne OK. LLM wolno używać do pisania kodu. — Qwen3.5-4B (Apache-2.0) w llama.cpp; `scripts/verify_stack.sh`: brak trasy do Internetu z sieci `backend`, obraz `api` działa z `--network none`. Ten sam otwarty model na własnym serwerze GPU dopuścił mentor (21.11).
- [x] Brak licencji komercyjnych — [LICENSES.md](LICENSES.md)
- [x] REST API: upload pojedynczego pliku (blankiet formularza) — `src/formgen/api/upload.py`
- [x] Formaty: .pdf .doc .docx .ods .xlsx .jpg .jpeg .png — `ALLOWED_EXTENSIONS` w `src/formgen/config.py`, parsery `src/formgen/ingest/`, test parametryzowany w `tests/api/test_analyze.py`
- [x] Walidacja MIME (zawartość == rozszerzenie) — magika w `src/formgen/ingest/detect.py`, `415 MIME_MISMATCH` w `src/formgen/api/upload.py`, `tests/api/test_analyze.py`
- [x] Walidacja nazwy pliku: <= 250 znaków, zakazane znaki: `; : > < / \ | ' * % $` — `src/formgen/api/upload.py`, testy każdego znaku i 251 znaków w `tests/api/test_analyze.py`
- [x] Max rozmiar pliku konfigurowalny (parametr aplikacji / env) — `MAX_UPLOAD_SIZE_MB` (`src/formgen/config.py`), `test_too_large`
- [x] Plik przetwarzany tylko w RAM lub tmp na czas żądania – brak trwałego storage — `read_limited` czyta do `bytes` (`src/formgen/api/upload.py`); brak bazy i katalogu uploadów
- [x] Docker: oficjalne obrazy bazowe, lekkie (Alpine), jawne wersje, bez `latest`, dedykowany user bez roota, tylko wymagane porty, sekrety przez env w runtime — `Dockerfile` (`USER app`, przypięte tagi, `EXPOSE 8000`), `compose.yaml` (`read_only`, sieć `backend` `internal`); zamiast Alpine `python:3.14.4-slim-trixie`, uzasadnienie w SPEC R-11
- [x] Konfiguracja: max rozmiar pliku, parametry JWT, parametry integracyjne — `src/formgen/config.py`, tabela w `README.md`
- [x] README.md: build Docker, uruchomienie, konfiguracja, opis REST API — `README.md`

## Wymagania formalne (zgłoszenie)
- [x] Tytuł + szczegółowy opis projektu — `README.md`, sekcja „Zgłoszenie”
- [ ] Prezentacja PDF (max 10 slajdów) — w toku: szkic `docs/06-prezentacja/prezentacja-szkic-2026-11-22.pdf`
- [x] Wynikowe pliki JSON dla formularzy z pkt 3.1.II — `data/output/` (7 do oceny + 2 wzorcowe)
- [ ] Film max 3 min w otwartym repo (link)
- [x] Repozytorium kodu — `HackNation2026-dev/formularze`, gałąź `main`
- opcjonalnie: screeny, link do demo, grafiki

## Testowanie przez jury
Finaliści uruchamiają rozwiązanie na NOWYCH plikach podczas obrony. Rozwiązanie musi działać offline, na żywo, na dowolnym formularzu.

## Kryteria oceny
| Kryterium | Waga |
|---|---|
| Kompletność (minimum + rozszerzenia I–V) | 30% |
| Intuicyjność | 20% |
| Jakość kodu | 20% |
| Potencjał wdrożeniowy (w tym koszt) | 20% |
| Oryginalność | 10% |

## Materiały od organizatora (Discord: kanał `Cyfryzacja formularzy/materiały-dodatkowe`)
1. Przykładowe formularze (różne formaty) + odpowiadające JSON-y + screeny eUsługi -> `data/input/01..03`
2. Formularze do oceny (bez JSON) -> `data/input/04_formularze_do_oceny`
3. Wymagania projektowania formularzy + założenia techniczne konfiguracji -> `data/input/05_wymagania_projektowanie`
4. Opis słowników i danych inicjalnych -> `data/input/06_slowniki`
5. Tokeny (dla pierwszych 20 zespołów) – prawdopodobnie do LLM na etapie dev; w runtime i tak zakaz API
