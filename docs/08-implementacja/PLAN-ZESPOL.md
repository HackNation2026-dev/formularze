---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Plan pracy zespołu (od wieczora 21.11)

Gałęzie: `develop` = codzienna praca (domyślna), `main` = tylko stan pokazywany jury. Każdy strumień = osobny branch od `develop`, mały PR do `develop`, merge po zielonym CI (testy, ruff, dokumentacja). `develop` -> `main` tylko przez PR „release” po `scripts/verify_stack.sh`.
Zasada: `make test` zielone przed każdym PR. Nowe zależności tylko open source bez copyleft, wpis w `docs/08-implementacja/LICENSES.md`.

## Strumień 0. Merge i baza (zrobione 21.11)
PR #1 i #2 na `main`, PR #3–#7 w `develop` (zintegrowane, 168 testów). CI uruchamia testy na każdym push i PR.
Start pracy: `git checkout develop && git pull && python3 scripts/sync_materials.py && make test`.
Dwie sesje agenta nigdy w jednym katalogu: `git worktree add ../formularze-<nazwa> develop`.

## Strumień A. Frontend (1–2 osoby, punkty IV + intuicyjność 20%)
Stan: interfejs `/review/` jest w repo ([UI-PRZEGLAD](UI-PRZEGLAD.md)). Pokrywa kroki 1–4 poza listą wielu plików i formatami innymi niż PDF. Dalsza praca rozbudowuje go zamiast zaczynać od nowa.
Spec: `docs/08-implementacja/FRONTEND-BRIEF.md`. Biblioteka JSONata już w `src/formgen/static/vendor/`.
Kolejność:
1. Upload + lista plików + status + pobranie JSON (pół dnia).
2. Wizualizacja JSON jako e-usługa: karty sekcji, typy pól, taby, przyciski Wstecz/Dalej (pół dnia).
3. Stany SHOW/READ_ONLY liczone JSONata na żywo; test akceptacyjny na goldenie 05 (ćwierć dnia).
4. Wczytanie dowolnego JSON z dysku (godzina).
Dev bez modelu: `AUTH_ENABLED=false EXTRACTOR=heuristic make run`.
Definicja ukończenia: jury wrzuca PDF, widzi formularz, klika „Innej osoby” i pojawia się sekcja pełnomocnictwa.

## Strumień B. Jakość ekstrakcji (1 osoba, kompletność + oryginalność)
Pętla ewaluacji (zasady zespołu z 22.11):
- zmiana w post-processingu (`to_spec`, `assemble.py`, walidacja): tylko `make eval-warm` (cache odpowiedzi modelu, ~10 s, zero wywołań GPU; chybienie w cache = ERROR);
- zmiana promptu: `scripts/eval_fast.sh --cold` raz, potem znów ciepło;
- smoke = formularze 05, 09, 04, 01; 08 nigdy w smoke; `make eval-full` (9 formularzy, zimno) tylko przed commitem;
- wspólny cache: `~/.cache/formgen-eval` (zmienna `EVAL_CACHE`); SCORE bazowy na smoke (develop, 22.11): 0,7363.
1. Otwórz 7 plików `data/output/*.json` w wizualizacji (lub `scripts/run_e2e.py` z `--out`). Spisz powtarzalne błędy modelu: duplikaty, TEXT zamiast RADIO, zły podział na strony.
2. Poprawki w `src/formgen/extract/prompts.py` i `extractor.py`. Po każdej: `make e2e` (golden 05) i `make batch` na Legionie (`LLM_BASE_URL=http://100.111.226.49:18081`).
3. Miara: `compare()` w `src/formgen/eval/metric.py`; nie schodzić poniżej composite 0,90 na goldenach.
Definicja ukończenia: każdy z 7 JSON-ów przejrzany, lista błędów zamknięta lub opisana w `docs/08-implementacja/`.

## Strumień C. Walidatory i nowy słownik (1 osoba, punkty II + V)
1. Przenieś algorytmy z `docs/08-implementacja/research/spikes/03_validators_check.py` do `src/formgen/schema/validators.py` (PESEL, NIP, REGON, kod pocztowy, dowód, ePUAP, ADE). Testy.
2. Endpoint `POST /api/v1/forms/validate` ma zwracać też błędy przykładowych wartości (opcjonalnie) albo frontend używa tych funkcji w JS.
3. Nowy słownik: z outputów 09 (dyscypliny sportowe), 07 (rasy psów), 05 (rodzaje podatku). Dokument [`docs/08-implementacja/NOWE-SLOWNIKI.md`](NOWE-SLOWNIKI.md): nazwa, struktura (id, name, techName), wartości, pola, które go użyją. Forma w JSON zależy od odpowiedzi mentora (pytanie 3 na Discordzie); domyślnie `options` w polu + dokument.
Definicja ukończenia: walidatory mają testy na poprawnych i błędnych numerach; dokument słowników ma min. 2 słowniki z wartościami.

## Strumień D. Dostarczenie i obrona (1 osoba, potencjał wdrożeniowy 20% + wymagania formalne)
1. Przebuduj obraz po zmianach i uruchom `scripts/verify_stack.sh` na x86 (Legion). Wklej wynik do README jako „Weryfikacja”.
2. `docker compose` z GPU: plik `compose.gpu.yaml` (override: obraz `server-cuda`, `--device`), instrukcja w README.
3. Prezentacja (max 10 slajdów): problem, architektura (strona z artefaktu), pomiary, demo, koszt wdrożenia (z `docs/08-implementacja/research/05-gdzie-uruchomic.md`).
4. Film (max 3 min): upload w GUI, JSON, wizualizacja, `verify_stack.sh` w terminalu. Link w README.
5. Opis projektu i tytuł w README. Zgłoszenie.
Definicja ukończenia: ktoś spoza zespołu uruchamia stack z README na czystej maszynie i dostaje JSON.

## Ja (Mateusz + Claude)
- Odpowiedzi mentorów -> kod (zależne listy adresu, forma nowego słownika, sprzęt).
- Strony alternatywne, jeśli mentor da sposób zapisu.
- Unlimited-OCR jako `OCR_BACKEND=unlimited` (sidecar llama.cpp), tylko jeśli jury zapowie skany.
- Review PR-ów ze strumieni A–D.

## Zależności
- A i B ruszają z `develop`.
- C.2 i D.3–D.5 na końcu, po B.
- Przed obroną: PR `develop -> main` (#8) po `verify_stack.sh` na x86.
