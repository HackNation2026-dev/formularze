---
wersja: 0.5.0
aktualizacja: 2026-11-22 08:20
status: stan na ostatnie godziny przed zgłoszeniem
---

# Stan projektu i plan do zgłoszenia

Jeden dokument zamiast szukania po sesjach, gałęziach i pamięci agentów. Czytaj od góry: co jury dostaje, co już jest,
czego brakuje, kto co robi teraz. Termin zgłoszenia: potwierdź na Discordzie (wcześniejsze ustalenie: 22.11 około 10:00).

## 1. Źródło prawdy

| Co | Gdzie |
|---|---|
| Repo zespołu | `HackNation2026-dev/formularze`, klon `~/.t3/projects/formularze` |
| Stan dla jury | gałąź `main` = `7e9dd2b` (release #47), `verify_stack.sh` 15/15 na x86 CPU; następny release po wsadzie i verify (sesja D) |
| Praca bieżąca | gałąź `develop`: po 08:15 ma #48/#49/#52 (CPU 05: 207 s -> 122 s), #51 (ten dokument), #53 (README Zgłoszenie), #54 (architektura zgodna z kodem) |
| Stary katalog scratch | `~/.t3/projects/hacknation-cyfr-forumla` – bez remote, kod rozjechany, **nie pracuj tam**. Projekt T3 wskazuje ten katalog, stąd nowe sesje lądują w złym repo. Przepnij projekt T3 na `~/.t3/projects/formularze`. |
| Serwer demo (GPU) | Legion, `llmsrv` (Qwen3.5-4B, port 18081), tunel Cloudflare `cfl`, URL zmienia się po restarcie: `docker logs cfl` |
| Stack jury (CPU) | Legion `~/formularze` na `7e9dd2b`, `formularze-api-1` działa |

## 2. Co jury ocenia i co mamy

Kryteria: kompletność 30 %, intuicyjność 20 %, jakość kodu 20 %, wdrożenie i koszt 20 %, oryginalność 10 %.

| Wymaganie | Stan | Dowód |
|---|---|---|
| REST API, 8 formatów, walidacja uploadu, JWT, limity | JEST | `src/formgen/api`, 212 testów, `verify_stack.sh` 15/15 |
| JSON zgodny z JSON-ami referencyjnymi COI | JEST | golden 05 / 01 composite 0,92 / 0,92 |
| Zasady projektowania COI (strony, sekcje, kontakt, FINISH) | JEST | deterministyczny kompilator szablonów |
| Dokumentacja architektury | JEST | `docs/04-architektura/`, `docs/08-implementacja/` |
| I. Słowniki i dane inicjalne | JEST | `schema/dictionaries.py`, nazwy z dokumentu „Słowniki” |
| II. Propozycja nowego słownika | JEST | `NOWE-SLOWNIKI.md`, rejestr `PROPOSED` (05, 07, 09) |
| III. Zależności dynamiczne (JSONata) | JEST | warunki widoczności, lint JSONata, test cykli |
| IV. Frontend upload + JSON | JEST | `/review/`, wsad wielu plików, 14 testów Playwright |
| V. Wizualizacja e-usługi | JEST | `/review/` symuluje strony i warunki na żywo |
| VI. Walidacje pól, batch, korekta in-place | JEST | `validators.py`, `/forms/validate`, `analyze-batch`, szybka edycja w UI |
| Docker non-root, przypięte tagi, sekrety przez env | JEST | `Dockerfile`, `compose.yaml` |
| README: build, run, konfiguracja, API | JEST | `README.md` |

Zgłoszenie formalne:

| Element | Stan |
|---|---|
| Tytuł i opis projektu | CZĘŚCIOWO – README ma opis, brak sekcji „Zgłoszenie” z tytułem i linkami |
| Prezentacja PDF (max 10 slajdów) | **BRAK** – jest tylko treść w `docs/06-prezentacja/SLAJDY-I-FILM.md` |
| Wynikowe JSON-y 01–09 | **PRZESTARZAŁE** – `data/output/` z 21.11 21:43, kod od tego czasu zmienił ingest XLSX/ODS, budżet tokenów, nagłówki częściowego wyniku |
| Film (max 3 min) w repo | **BRAK** – scenariusz z minutażem jest w `SLAJDY-I-FILM.md` |
| Repozytorium publiczne | JEST |

## 3. Co jest otwarte i co z tym robimy

| Rzecz | Decyzja |
|---|---|
| PR #48, #49, #50 (CPU: checkpointy, prefill prefiksów, 2 równoległe wywołania; 05 na CPU 207 s -> 122 s) | ZMERGOWANE 08:00 (#50 jako #52 po rebase). Czeka `verify_stack.sh` i release. |
| PR #20 (blind_eval, testy czerwone) | Nie blokuje. Autor naprawia testy albo zamykamy po konkursie. |
| `origin/feat/gui-next` (nowy frontend, 20 k linii, bez PR, bez weryfikacji) | NIE wchodzi do stanu jury. Demo pokazuje `/review/`. Autor może pokazać osobno jako „dalszy rozwój”. |
| Issue #35–#39 (graf zadań z osieroconego sprintu) | ZAMKNIĘTE 08:00; zostaje #40 jako lista odbioru. |
| Kontener `llm-exp` (Qwen3.5-2B) na Legionie | ZATRZYMANY 08:00. |
| 13 worktree i gałęzie `perf/*`, `fix/*` lokalnie | Po konkursie. Teraz nie dotykać. |
| Zmiany w `src/formgen/extract/` | ZAMROŻONE do końca konkursu. Każda zmiana promptu przy 4B to dni, nie godziny (lekcja z PR #34). |

## 4. Plan sesji (równolegle, każda w osobnym worktree od `develop`)

Kolejność na Legionie jest szeregowa, bo CPU i GPU dzielą 12 GB RAM: najpierw wsad przez GPU, potem `verify_stack.sh`.

### Sesja A – wyniki do oddania (krytyczna, ~25 min)

1. `git worktree add ../formularze-wyniki develop`, `python3 scripts/sync_materials.py`.
2. `LLM_BASE_URL=<tunel> LLM_API_KEY=<klucz z Legiona ~/ocr-bench/llm_api_key.txt> LLM_FALLBACK_HEURISTIC=false python scripts/batch.py --goldens --jobs 2`.
3. Sprawdź: 9 plików, walidator 0 błędów, brak `DANE WSPÓLNE SPRAWY`, brak pól podatkowych w 02–04 i 06–09, 09 ma listę dyscyplin, 03 ma listę wyboru.
4. PR `chore(output): JSON-y z kodu 7e9dd2b` do `develop`.

### Sesja B – prezentacja PDF (krytyczna, ~30 min; decyzja 08:05: slajdy robi człowiek w Figmie na końcu)

1. Z `docs/06-prezentacja/SLAJDY-I-FILM.md` zrób 10 slajdów (pptx -> PDF). Liczby z README „Pomiary” i z sesji A.
2. Diagram architektury: `docs/04-architektura/`. Zrzuty `/review/` z formularza 05.
3. Plik do `docs/06-prezentacja/prezentacja.pdf`, link w README.

### Sesja C – film (krytyczna, człowiek nagrywa, agent przygotowuje, ~40 min)

1. Agent: zatrzymaj `llm-exp`, sprawdź tunel, `AUTH_ENABLED=false` na stacku demo, przygotuj pliki 05 PDF i 03 XLSX.
2. Człowiek: nagranie według tabeli minutażu w `SLAJDY-I-FILM.md` (upload, JSON, wizualizacja, zależna sekcja, słownik i walidacja, drugi format, `verify_stack.sh`).
3. Plik mp4 do repo (albo link), sekcja „Zgłoszenie” w README: tytuł, opis, link do filmu, PDF, JSON-y.

### Sesja D – release (po A, ~30 min na Legionie)

1. Merge #48, #49, #50 do `develop`.
2. Na Legionie: `git pull`, `docker compose build`, `scripts/verify_stack.sh` przy zatrzymanym wsadzie GPU.
3. Release PR `develop -> main`. Zaktualizuj README „Pomiary” o czas analizy na CPU po PR-ach.

### Sesja E – porządki (niekrytyczna, ~15 min)

1. Zamknij #35–#39 z komentarzem „wchłonięte przez #40 i release #47”.
2. Odhacz w #40 punkty spełnione po A i D.
3. Przepnij projekt T3 na `~/.t3/projects/formularze`.

## 4a. Audyt „czy coś się zgubiło” (08:10)

Porównano stary katalog scratch, gałęzie `impl/*`, `sprint-90-pkt` i niezmergowane gałęzie zespołu z `develop`. Nic nie musi wejść przed 11:00. Po konkursie warto przenieść: filtry anty-wyciekowe i neutralne prompty ekstrakcji (sprint), podział kolumn w `ingest/layout.py`, endpoint propozycji słowników z panelem w UI, pełniejszą edycję in-place (`edit.mjs`), upload pojedynczego pliku w 8 formatach z podglądem w `/review/`, rozszerzenie `.jpe`, panel diagnostyczny Gradio (scratch `main`). Gałąź `perf/indexed-extraction` zamknięta celowo (SCORE spadł).

## 5. Czego NIE robimy przed zgłoszeniem

- Nie zmieniamy promptów ani ekstraktora.
- Nie wdrażamy `feat/gui-next`.
- Nie dodajemy nowych zależności.
- Nie uruchamiamy równolegle wsadu GPU i `verify_stack.sh` na Legionie (poprzednio dało 1 falsz-negatyw przez timeout CPU).

## 6. Słownik pojęć używanych w sesjach

| Termin | Znaczenie |
|---|---|
| golden | jeden z 2 formularzy referencyjnych (01, 05) z JSON-em od organizatora |
| formularz do oceny | jeden z 7 formularzy bez JSON-a (02, 03, 04, 06, 07, 08, 09) |
| composite | metryka zgodności z goldenem (`src/formgen/eval/metric.py`), cel >= 0,90 |
| SCORE | metryka harnessu `scripts/eval_suite.py` na 9 formularzach (golden + spójność między formatami + pokrycie), baza A 0,7731 |
| smoke | podzbiór 01, 04, 05, 09 do `make eval-warm`; 08 nigdy w smoke |
| stan jury | gałąź `main`; zmienia się tylko przez release PR po `verify_stack.sh` |
| własna chmura | serwer GPU Legion z Qwen3.5-4B za tunelem; dozwolony przez mentora jako model otwarty i samohostowany |
| heurystyka | ekstraktor bez modelu, zapas przy awarii LLM; do wyników oddawanych wyłączony |
