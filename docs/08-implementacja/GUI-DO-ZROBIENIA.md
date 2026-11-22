---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: lista zadań po etapie 1 aplikacji `apps/web` (stan na commit scalenia do main)
---

# GUI (`apps/web`) — co zostało do zrobienia

Ten plik jest zleceniem dla kolejnych agentów. Każde zadanie jest samodzielne: ma cel, pliki, kroki i kryteria odbioru z poleceniami. Zadania Z1–Z12 są uporządkowane od najważniejszego. Zależności są wskazane w polu „Wymaga”.

## Stan na dziś (zrobione i zweryfikowane)

- Aplikacja Next.js 16 / React 19 / TypeScript strict w `apps/web/` (ADR-002), TanStack Query/Table/Form, next-intl (PL/EN), Tailwind v4 z tokenami z `design/tokens.css`, motyw jasny/ciemny.
- Atomic design system w `apps/web/src/design-system/` (atomy, molekuły, organizmy, szablony) i katalog `/[locale]/design-system`.
- Widoki: logowanie, upload z kolejką i szczegółami, wynik JSON, walidacja, podgląd e-usługi ze stanami dynamicznymi (silnik `src/lib/preview`), otwórz JSON z dysku, ustawienia, stany błędów (413, 415, 400, 401, 504, 503) i pustki.
- Mock API (MSW) zgodny z kontraktem `src/formgen/api/` (`/health`, `/ready`, `/formats`, `/analyze`, `/analyze-batch`, `/validate`, scenariusze błędów po nazwie pliku).
- Testy: 324 jednostkowe (Vitest), 28 e2e (Playwright, Chromium), lint, typecheck, build. CI: `.github/workflows/web.yml` (bez e2e).
- Tokeny: `design/tokens.css` (źródło), `design/tokens.json` (generowany `scripts/gui_tokens_from_css.py`), test kontrastu `tests/test_gui_tokens.py`.

## Zasady dla każdego agenta

1. Pracuj w osobnym worktree na własnej gałęzi z aktualnego `main`: `git fetch origin && git worktree add ../formularze-<zadanie> -b feat/<zadanie> origin/main`. Nie pracuj na `main` i `develop`.
2. Najpierw przeczytaj: `AGENTS.md`, `docs/superpowers/specs/2026-11-22-gui-next-design.md`, `docs/08-implementacja/GUI-MAKIETY.md`, `apps/web/README.md`, `docs/07-decyzje/ADR-002-gui-nextjs.md`.
3. Pisz po polsku (commity, dokumentacja, komentarze). Commity małe: `feat(web): ...`, `fix(web): ...`, `docs: ...`, `test(web): ...`.
4. Zależności tylko z `npm install --save-exact`, lockfile w commicie, bez copyleftu (GPL/LGPL/AGPL zakazane; MPL tylko jako zależność narzędziowa po wpisaniu do `LICENSES-WEB.md`), bez CDN i żądań zewnętrznych w runtime.
5. Kolory i odstępy wyłącznie z tokenów (zakaz `#hex`, `rgb(` i `!` w klasach), teksty tylko w `apps/web/messages/{pl,en}/*.json` z tymi samymi kluczami.
6. Przed oddaniem uruchom w `apps/web`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `PLAYWRIGHT_PORT=<wolny port> npm run e2e`; w katalogu głównym `python3 scripts/verify_docs.py` (po przeniesieniu `.venv` poza repo, patrz Z11) oraz, gdy dotykasz Pythona, `ruff check src tests scripts`, `ruff format --check src tests scripts`, `pytest -q`.
7. Oddaj przez PR do `main` (chroniony: wymaga zielonych sprawdzeń `tests` i `docs`; PR nie wymaga zatwierdzeń). Nie wypychaj bezpośrednio na `main`. W opisie PR: co zrobiono, wyniki poleceń, odstępstwa.
8. Odhaczaj zrealizowane kroki w `docs/superpowers/plans/2026-11-22-gui-next.md` i dopisz wpis do `CHANGELOG.md` (sekcja „Niewydane”).

---

## Z1 — Weryfikacja, źródło PDF, edycja pól, uwagi, raport, wsad (W3c)

**Cel:** przenieść do `apps/web` przepływ z istniejącego `src/formgen/static/review/` (nie kopiuj kodu, odtwórz zachowanie): źródło PDF obok pól, przegląd z edycją, uwagi, raport v2, wsad do `/analyze-batch`. Spec: `docs/superpowers/specs/2026-11-22-gui-next-design.md`, sekcja „Przepływ weryfikacji”. Szkice makiet: `GUI-MAKIETY.md` i sekcja o szkicach (Phone/ResultSource, Phone/ReviewFields, Tablet/ReviewSplit).
**Wymaga:** nic (Z5 poprawi warunki w powtórzeniach, ale nie blokuje).

**Pliki (nowe, własność tego zadania):** `apps/web/src/features/review/{types.ts,edit.ts,digest.ts,report.ts,store.ts,useReview.ts}`, `apps/web/src/features/batch/{useBatch.ts,store.ts}`, `apps/web/src/design-system/organisms/{SourceViewer,ReviewFieldList,NotesPanel,EditLog,BatchList}.tsx` (+ testy `*.test.tsx`), trasy `apps/web/src/app/[locale]/results/[id]/{source,review}/page.tsx` i `apps/web/src/app/[locale]/batch/page.tsx`, `apps/web/messages/{pl,en}/{review,batch}.json` (zarejestruj w `src/i18n/messages.ts`), wpisy katalogu w `src/app/[locale]/design-system/catalogue/` (nowe pliki + linie w `index.ts`), `apps/web/scripts/sync-pdfjs.mjs`, `apps/web/e2e/review.spec.ts`. Zmiany w istniejących: `design-system/templates/ResultLayout` (dwie nowe zakładki), `features/open-json/load.ts` i trasa `/open` (PDF + JSON).

**Kroki:**
1. `cd apps/web && npm install --save-exact pdfjs-dist@5.4.394` (ta sama wersja co w głównym `package.json`; licencja Apache-2.0). Skrypt `scripts/sync-pdfjs.mjs` kopiuje `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` do `public/pdf.worker.min.mjs`; dodaj do `package.json` skrypt `sync:pdfjs` i wywołaj go w `prebuild` i `predev`. W kodzie: `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`, import dynamiczny (`await import('pdfjs-dist')`) tylko po wejściu na zakładkę Źródło.
2. `edit.ts` (czyste funkcje na głębokiej kopii konfiguracji, kopia robocza w `reviewStore`, oryginał w `results` zostaje nietknięty): `fields(config)` (spłaszczona lista pól z `key` w formacie ścieżki `tab.indeks.indeks...` liczbowej, `title`, `techName`, `type`), `renameField(config,key,title)`, `retypeField(config,key,type)` (dozwolone typy: dla kontenerów `SECTION` i `REPEATING_SECTION`, dla liści `TEXT_FIELD, TEXTAREA, NUMBER, CHECKBOX, RADIO, SELECT, DATEPICKER, FILE_UPLOADER, CONSENT_SECTION, TEXT_BLOCK, INFO_SECTION`; zmiana typu nie zmienia rodzaju: liść nie dostaje siatki, kontener nie traci dzieci), `deleteField(config,key)`. Usuwanie: wytnij pytanie z listy `questions` (lub `repeatingSectionGrid` rodzica), potem dla każdego innego pytania z tej listy o `y` większym niż `y` usuniętego: jeśli `field.questionOrder === y`, odejmij `question.rows ?? 1` od `questionOrder`; od `y` odejmij `question.rows ?? 1`. Zwróć wpis dziennika: `{action:'delete', techName, removed:[techName usuniętego i wszystkich zagnieżdżonych (rekurencyjnie po repeatingSectionGrid)]}`; dla zmian `{action:'rename'|'retype', techName, from, to}`. Wzór: `src/formgen/static/review/configuration.mjs` (`editField`, `typeChoices`).
3. `digest.ts`: `canonicalJson(value)` = JSON UTF-8 z posortowanymi kluczami obiektów (rekurencyjnie), separatory zwarte (`,` i `:` bez spacji), kolejność tablic zachowana; `sha256Hex(text)` przez `crypto.subtle.digest('SHA-256')` i zapis szesnastkowy małymi literami.
4. `report.ts`: `buildReport(...)` zwraca dokładnie: `{reportVersion:2, configurationSha256, baseConfigurationSha256, editedByClerk, edits, hashMethod, configurationTitle, provenance, sourcePdfName, createdAt, annotations}`; `hashMethod` = `"SHA-256 of UTF-8 JSON with sorted object keys, compact separators; array order preserved"`; `annotations[]` = `{kind:'field'|'missing', field:{title,techName,key,deleted}|null, location, text}`; uwaga przy polu podąża za żywym polem (po edycji aktualizuj `key`, po usunięciu `key:null, deleted:true`); `baseConfigurationSha256` = skrót konfiguracji przed jakąkolwiek edycją; nazwy plików eksportu: `konfiguracja-<pierwsze 12 znaków skrótu>.json` (czysty JSON po edycjach) i `raport-<12 znaków>.json`. Eksport przez `Blob` i `URL.createObjectURL` (jak w `features/results`).
5. `SourceViewer`: render strony na `<canvas>` z `devicePixelRatio`, przyciski „Poprzednia strona”/„Następna strona”, napis „Strona X z Y”, `<details>` „Tekst strony” z `page.getTextContent()`, anulowanie trwającego `renderTask` przy zmianie strony, dla obrazów (jpg, png) element `<img>` z `URL.createObjectURL(file)` i `revokeObjectURL` przy odmontowaniu; brak `sourceFile` = stan pusty „Brak dokumentu źródłowego”; błąd odczytu = komunikat z `role="alert"`. Plik źródłowy pochodzi z `getResult(id).sourceFile` (kolejka) lub z `/open`.
6. `ReviewFieldList`: przełącznik trybów „Przegląd wszystkich pól” (pokazuje także pola ukrywane warunkowo) i „Symulacja” (używa `FormRenderer` i `usePreview`, odpowiedzi użytkownika, warunki JSONata). Przy każdym polu: „Edytuj” (tytuł, typ z listy), „Usuń” (z potwierdzeniem), „Dodaj uwagę do pola” (formularz: Miejsce w PDF, Uwaga; zapis wymaga niepustej uwagi). Poza listą: „Zgłoś brakujące pole” (uwaga `kind:'missing'`). `EditLog` pokazuje wpisy `rename/retype/delete`; `NotesPanel` listę uwag („Pole (techName) — lokalizacja”, „— pole usunięte”).
7. Walidacja z przeglądu: przycisk „Waliduj strukturę przez API” (`useValidate` z `src/lib/api`, wynik w `ValidationList`) i „Waliduj wartości” (pole `sample_values` jako JSON; wynik `sample_errors`, `sample_unknown`). Ostrzeżenie `beforeunload` oraz modal przy wczytywaniu innej konfiguracji, gdy są niezapisane uwagi lub edycje („Pobierz raport przed wczytaniem innej konfiguracji. Odświeżenie karty usuwa uwagi.”).
8. Wsad: hook `useBatch` wysyła wszystkie wybrane pliki jednym `multipart` (pole `files`) do `/api/v1/forms/analyze-batch`; limit po stronie klienta `MAX_BATCH_FILES = 20` (backend: `max_batch_files`, domyślnie 20, powyżej `TOO_MANY_FILES` 413; backend nie ujawnia limitu, patrz Z6). Trasa `/batch`: strefa upuszczania „Wiele plików (maks. 20)”, podsumowanie „X z N gotowych”, lista wierszy (`filename`, `status`, kod błędu, „Otwórz” → `putResult` + `/results/<id>/preview`, „Ponów” dla błędów przez `/analyze`), przycisk „Dodaj kolejne pliki”. W mocku (`src/mocks/handlers.ts`, linia z `files.length > 10`) zmień limit na 20, żeby odpowiadał backendowi.
9. `/open`: dwa pola plików „PDF źródłowy” (opcjonalne, `.pdf`) i „Konfiguracja JSON” (wymagane, `.json`), walidacja kształtu (`title`, `tabs`, `flow`), `provenance` = nazwa pliku; wynik z `sourceFile` = PDF i `source:'local'`.
10. `ResultLayout`: dodaj zakładki „Źródło” (`/results/[id]/source`) i „Przegląd” (`/results/[id]/review`) jako dane; na tablecie (≥768 px) zakładka Przegląd pokazuje układ dzielony: źródło po lewej (300–360 px), pola i panel uwag po prawej.
11. Testy: `edit.test.ts` (usunięcie środkowego wiersza siatki: `y` i `questionOrder` kolejnych pytań maleją o `rows ?? 1`; usunięcie sekcji powtarzanej zwraca w `removed` wszystkich potomków; zmiana typu liścia na kontener jest odrzucana), `digest.test.ts` (wektor: `sha256Hex('abc')` = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`; `canonicalJson({b:1,a:[2,1]})` = `{"a":[2,1],"b":1}`; niezmienność przy zmianie kolejności kluczy), `report.test.ts` (kształt raportu, uwaga po usunięciu pola ma `deleted:true` i `key:null`, `editedByClerk` zależy od liczby edycji), komponenty (`SourceViewer` z atrapą pdfjs, `ReviewFieldList`, `BatchList`), e2e `review.spec.ts` (PL/EN, 390 i 820 px): otwórz PDF + JSON → źródło obok pól → edycja tytułu → usunięcie pola → uwaga → raport i czysty JSON pobrane (sprawdź nazwy plików i zawartość) → wsad z błędami 415 i `TOO_MANY_FILES`.

**Kryteria odbioru:** `npm run lint && npm run typecheck && npm run test && npm run build && PLAYWRIGHT_PORT=3140 npm run e2e` zielone; raport z aplikacji i raport z `/review/` dla tej samej konfiguracji mają ten sam `configurationSha256` (porównaj ręcznie na fixture `05_nadplata_podatku.json`); nowe klucze i18n równe w PL i EN.
**Pułapki:** nie mutuj `getResult(id).form` (edycje tylko na kopii roboczej); przy dużych PDF-ach nie renderuj wszystkich stron naraz; HTML z opisów zawsze przez `sanitizeHtml`; worker pdf.js musi być serwowany lokalnie (żadnych żądań poza własnym origin).

---

## Z2 — Dostępność (axe) i obsługa klawiatury

**Cel:** zero naruszeń WCAG 2.1 AA na wszystkich trasach, pełna obsługa klawiatury.
**Wymaga:** nic.
**Pliki:** `apps/web/e2e/a11y.spec.ts` (nowy), poprawki w komponentach `src/design-system/**`.
**Kroki:**
1. `npm install --save-exact --save-dev @axe-core/playwright` (licencja MPL-2.0, tylko dev/test; wpis do `LICENSES-WEB.md` w Z4 i decyzja właściciela).
2. `e2e/a11y.spec.ts`: dla tras `/login`, `/upload` (z kolejką po przesłaniu pliku), `/results/<id>/{json,validation,preview}` (wynik z fixture), `/open`, `/settings`, `/design-system` oraz stanów błędów (413, 415, 401), w układzie 2 języki × 2 motywy × szerokości 390 i 820 uruchom `new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()` i asercję `violations` równe `[]`.
3. Test klawiatury: przejście `Tab` przez każdą trasę (kolejność logiczna, widoczny fokus `:focus-visible` o kontraście ≥ 3:1), `Esc` zamyka `BottomSheet` i `SidePanel`, fokus wraca do elementu otwierającego i jest uwięziony w otwartym arkuszu, skrót do treści („Przejdź do treści”), poprawna hierarchia nagłówków (jeden `h1` na stronę), `aria-live="polite"` dla zmian statusu kolejki, `prefers-reduced-motion` wyłącza animacje (spinner, pasek postępu).
4. Napraw wszystkie wykryte problemy w komponentach (nie wyciszaj reguł).
**Kryteria odbioru:** `PLAYWRIGHT_PORT=3141 npm run e2e -- a11y.spec.ts` zielone; ręczna lista kontrolna w opisie PR (czytnik: NVDA lub VoiceOver przez jeden scenariusz upload → wynik).

---

## Z3 — Brak żądań zewnętrznych i nagłówki bezpieczeństwa

**Cel:** udowodnić offline-first (COI-04) i dodać CSP.
**Wymaga:** nic.
**Pliki:** `apps/web/e2e/network.spec.ts` (nowy), `apps/web/next.config.ts` (nagłówki), ewentualnie `apps/web/src/app/[locale]/layout.tsx` (nonce dla skryptu motywu).
**Kroki:**
1. `e2e/network.spec.ts` na buildzie produkcyjnym (`npm run build && npm run start`): przez cały przepływ (login → upload → wynik → podgląd → ustawienia, PL i EN) zbieraj `page.on('request')` i asercją sprawdź, że `new URL(url).origin` jest równy origin aplikacji (dozwolone też `data:` i `blob:`); żadnych żądań do fontów ani CDN.
2. W `next.config.ts` dodaj `headers()` dla `/:path*`: `Content-Security-Policy` (`default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` bez kamery/mikrofonu/geolokalizacji. Skrypt inicjalizujący motyw jest inline, więc wymaga nonce (middleware/`proxy.ts` generuje nonce i przekazuje do layoutu) lub zamiany na skrypt z `'self'`. Tryb `dev` (HMR) wymaga luźniejszej polityki: stosuj ścisłą wyłącznie w `production`.
3. Sprawdź, że MSW w trybie mock działa pod CSP (`mockServiceWorker.js` ma ten sam origin, `worker-src 'self'`).
**Kryteria odbioru:** test sieciowy zielony; w przeglądarce w produkcji brak błędów CSP w konsoli na wszystkich trasach; `npm run e2e` całość zielona.

---

## Z4 — Spis licencji `LICENSES-WEB.md` i decyzje licencyjne

**Cel:** spełnić COI-06 (spis wersji i warunków licencyjnych, bez copyleftu).
**Wymaga:** najlepiej po Z1–Z3 (nowe zależności), ale można zrobić wcześniej i odświeżyć.
**Pliki:** `apps/web/scripts/licenses.mjs` (nowy), `docs/08-implementacja/LICENSES-WEB.md` (generowany), test `apps/web/src/lib/licenses.test.ts` (istnieje test braku GPL/LGPL/AGPL w lockfile; zachowaj go).
**Kroki:**
1. Skrypt bez nowych zależności: czyta `apps/web/package-lock.json` (v3: pola `packages["node_modules/<nazwa>"].{version,license,dev,optional}`), uzupełnia brakujące licencje z `node_modules/<nazwa>/package.json`, generuje tabelę Markdown (nazwa, wersja, licencja, zakres: produkcyjna/deweloperska, uwagi) posortowaną po nazwie i zapisuje do `docs/08-implementacja/LICENSES-WEB.md` z nagłówkiem (`wersja`, `aktualizacja`, `status`) wymaganym przez `scripts/verify_docs.py`. Dodaj skrypt npm `licenses`.
2. W dokumencie opisz wyjątki: (a) `sharp` zastąpiony lokalnym pakietem `@formgen/disabled-sharp` (ISC) w `apps/web/scripts/disabled-sharp`, bo opcjonalny `libvips` jest LGPL; sposób odtworzenia archiwum: `npm run pack:disabled-sharp`; konsekwencja: `images.unoptimized` w `next.config.ts` (brak optymalizacji obrazów); (b) MPL-2.0: `lightningcss` (narzędzie budowania Tailwind, nie trafia do przeglądarki) i `axe-core` / `@axe-core/playwright` (tylko testy); (c) czcionki `@fontsource/*` na licencji OFL-1.1, osadzone lokalnie.
3. Test: lista dozwolonych licencji (MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, OFL-1.1, CC0-1.0, Python-2.0, BlueOak-1.0.0, MPL-2.0 tylko dla wymienionych pakietów); każda inna licencja w lockfile oblewa test.
4. Poproś właściciela repo o decyzję na piśmie (w opisie PR) dotyczącą MPL-2.0 dla narzędzi deweloperskich i o akceptację obejścia `sharp`.
**Kryteria odbioru:** `npm run licenses` generuje plik bez różnic po drugim uruchomieniu; `python3 scripts/verify_docs.py` zielone; test licencji zielony.

---

## Z5 — Silnik podglądu: warunki wewnątrz instancji REPEATING_SECTION

**Cel:** warunki JSONata zależne od konkretnego powtórzenia (dziś silnik adresuje odpowiedzi tylko przez `techName`, więc ocena korzysta z ostatniej zmiany dla danego `techName`).
**Wymaga:** nic.
**Pliki:** `apps/web/src/lib/preview/index.ts` (+ testy `preview.test.ts`), `apps/web/src/design-system/organisms/FormRenderer.tsx`, `apps/web/src/features/preview/usePreview.ts`.
**Kroki:**
1. Zbadaj, jak backend generuje zapytania: `src/formgen/compose/jsonata.py` oraz formularze referencyjne z powtarzaną sekcją (`grep -l REPEATING_SECTION data/input/02_przyklady_json/*.json data/output/*.json`). Opisz w komentarzu JSDoc przyjętą semantykę (zapytanie widzi stan zbudowany dla danej instancji: odpowiedzi tej instancji podstawione pod `repeatingSectionGrid`).
2. Rozszerz stan o adres instancji: `applyAnswer(state, techName, value, instance?: number[])`, `evaluateStates` zwraca w `ViewModel.children` wynik dla każdej instancji (`children[i].visible`, `readOnly`, `conditionErrors`). Dla pól poza powtórzeniem zachowanie bez zmian (testy W2b muszą przejść bez edycji).
3. Dodaj syntetyczny fixture z sekcją powtarzaną i warunkiem zależnym od odpowiedzi w tej samej instancji (w `src/lib/preview/__fixtures__/`), testy: dwie instancje z różnymi odpowiedziami mają różną widoczność pól; usunięcie instancji nie psuje adresowania pozostałych; błędne zapytanie w jednej instancji nie wpływa na drugą.
4. `FormRenderer`: przekazuj indeks instancji do `applyAnswer`; „Dodaj kolejny” i „Usuń” instancję aktualizują stan.
**Kryteria odbioru:** `npm run test` (w tym 51 testów W2b bez zmian) i `npm run build` zielone; test e2e na fixture z powtórzeniem.

---

## Z6 — Backend: flaga `auth_enabled` i limit wsadu w API + dopięcie w UI

**Cel:** UI wie, czy pokazać „Kontynuuj bez logowania”, oraz zna limit wsadu (dziś zakłada 20 na sztywno).
**Wymaga:** nic (Python) i potem UI.
**Pliki (Python):** `src/formgen/api/app.py` (`ready` i `formats`), `tests/api/` (nowe testy), `docs/08-implementacja/SPEC.md` (sekcja B, kontrakt), `docs/08-implementacja/GUI-MAKIETY.md`. **Pliki (UI):** `apps/web/src/lib/api/schemas.ts`, `apps/web/src/mocks/handlers.ts` i `scenarios.ts`, `apps/web/src/design-system/organisms/LoginForm.tsx`, `apps/web/src/features/auth/hooks.ts`, trasy chronione.
**Kroki:**
1. `app.py`: w `ready` dodaj `"auth_enabled": st.auth_enabled` (pole `Settings.auth_enabled`, domyślnie `True`); w `formats` dodaj `"max_batch_files": st.max_batch_files`. Nie ujawniaj sekretów (`jwt_secret`). Test: `/ready` zwraca `auth_enabled` jako bool zgodnie z ustawieniem (`AUTH_ENABLED=false` i `true`), `/api/v1/formats` zawiera `max_batch_files` (domyślnie 20).
2. Zaktualizuj kontrakt w `SPEC.md` i sekcję „Kody i statusy” w `GUI-MAKIETY.md`.
3. UI: dodaj `auth_enabled: z.boolean().optional()` i `max_batch_files: z.number().optional()` do schematów; mock: obie wartości, scenariusz „auth włączone” i „auth wyłączone” wybierany w Ustawieniach (tryb mock); `LoginForm` pokazuje „Kontynuuj bez logowania” tylko gdy `auth_enabled === false`; gdy `true` i brak tokenu, trasy chronione przekierowują do `/login?returnTo=...`; gdy pole nieznane (starszy backend) zachowaj dotychczasowe zachowanie.
4. Wsad (jeśli Z1 już scalone): `MAX_BATCH_FILES` z `/formats` zamiast stałej.
**Kryteria odbioru:** `ruff check src tests scripts`, `ruff format --check src tests scripts`, `pytest -q` oraz w `apps/web` lint, typecheck, test, build, e2e zielone.

---

## Z7 — Niestabilny test jednostkowy

**Cel:** znaleźć i naprawić test, który raz padł (1 z 324) podczas uruchomienia `npm run test` tuż po `npm run lint` przy obciążonej maszynie, a w kolejnych uruchomieniach przechodził (nie udało się go odtworzyć).
**Wymaga:** nic.
**Kroki:**
1. W `apps/web`: `for i in $(seq 1 40); do npx vitest run --reporter=default 2>&1 | grep -E "FAIL|Tests "; done` oraz wariant `npx vitest run --sequence.shuffle` i `--pool=forks --poolOptions.forks.maxForks=1` równolegle z obciążeniem CPU (`yes > /dev/null &` x4) i zapisz pierwsze padnięcie z pełnym komunikatem.
2. Najpodejrzańsze: testy z timerami i asynchronicznością (`src/features/upload/store.test.ts`, `src/features/*/hooks.test.tsx`, `src/mocks/handlers.test.ts`, `src/lib/preview/cache.test.ts`, `src/design-system/organisms/*.test.tsx`). Napraw przyczynę (brakujący `await`/`waitFor`, nieposprzątany stan MSW `server.resetHandlers()`, współdzielony store między testami, zegar rzeczywisty zamiast `vi.useFakeTimers()`); nie dodawaj `retry`, `sleep` ani wydłużania limitów jako obejścia.
**Kryteria odbioru:** 50 kolejnych zielonych uruchomień `npm run test`, także pod obciążeniem CPU; opis przyczyny w PR.

---

## Z8 — Docker, serwowanie i e2e w CI dla `apps/web`

**Cel:** uruchamialny kontener aplikacji webowej obok API i e2e w CI.
**Wymaga:** decyzji właściciela: serwowanie przez Node (`next start`/`output: 'standalone'`), bo trasy są dynamiczne (eksport statyczny nie jest możliwy); odnotuj ją w ADR-002 (sekcja „Konsekwencje”).
**Pliki:** `apps/web/Dockerfile` (nowy), `compose.yaml` (usługa `web`), `apps/web/next.config.ts` (`output: 'standalone'`, `rewrites`), `.github/workflows/web.yml` (job e2e), `apps/web/README.md`.
**Kroki:**
1. `Dockerfile` wieloetapowy: obraz `node:22.23.1-alpine3.24` (ta sama wersja co etap UI w głównym `Dockerfile`, przypięta tagiem; dopisz digest tak jak dla pozostałych obrazów), etap `deps` (`npm ci`), `build` (`npm run build` z `NEXT_PUBLIC_API_MODE=live`), `run` z `.next/standalone`, użytkownik bez uprawnień roota, `EXPOSE 3000`, `HEALTHCHECK` na `/pl`. Bez sekretów w obrazie.
2. `next.config.ts`: `rewrites()` przekierowuje `/api/:path*`, `/health`, `/ready` do `${process.env.API_INTERNAL_URL ?? 'http://localhost:8000'}` (unikamy CORS: backend nie ma `CORSMiddleware`; nagłówki `X-*` są wtedy z tego samego origin). Zmienna `API_INTERNAL_URL` czytana po stronie serwera w runtime.
3. `compose.yaml`: usługa `web` (build `apps/web`, port 3000, `API_INTERNAL_URL=http://api:8000`, `depends_on: api`), bez zmian istniejących usług. Zaktualizuj README (budowanie i uruchomienie).
4. `web.yml`: dodaj job `e2e`: `npx playwright install --with-deps chromium`, `npm run build`, `CI=1 npm run e2e -- --workers=2`, artefakt `playwright-report/` przy porażce. Nie dodawaj tego joba do wymaganych sprawdzeń `main`, dopóki nie przejdzie stabilnie 10 razy z rzędu.
**Kryteria odbioru:** `docker compose build web` i `docker compose up web api` działają; `curl localhost:3000/pl/login` zwraca 200; job `e2e` zielony w PR.

---

## Z9 — Test dymny z prawdziwym backendem (tryb live)

**Cel:** upewnić się, że UI działa z rzeczywistym API (mock nie powiela walidatorów biznesowych Pythona).
**Wymaga:** Z8 (rewrites) lub uruchomienia obu serwerów na tym samym origin przez proxy.
**Pliki:** `apps/web/e2e/live.spec.ts` (nowy, pomijany bez `LIVE_API=1`), `apps/web/README.md`.
**Kroki:**
1. Backend lokalnie: `AUTH_ENABLED=false EXTRACTOR=heuristic python -m formgen` (zmienne w `.env.example`; port 8000). UI: `NEXT_PUBLIC_API_MODE=live API_INTERNAL_URL=http://localhost:8000 npm run build && npm run start`.
2. `live.spec.ts` (`test.skip(!process.env.LIVE_API)`): prześlij plik z `data/input/01_przyklady_formularze/` (np. PDF nadpłaty podatku), oczekuj wyniku JSON; w `Walidacja` wprowadź `sample_values` z błędnym PESEL i NIP i sprawdź `sample_errors` zwrócone przez prawdziwe walidatory; sprawdź nagłówek `X-Extractor` w szczegółach pliku.
3. W README opisz różnice mock vs live i dodaj komendę uruchomienia testu.
**Kryteria odbioru:** `LIVE_API=1 PLAYWRIGHT_PORT=3142 npm run e2e -- live.spec.ts` zielone na maszynie z uruchomionym backendem.

---

## Z10 — Odbudowa makiet FigCraft i zapis pliku w repo

**Cel:** makiety z poprzedniej sesji przepadły (restart silnika FigCraft; szczegóły w `GUI-MAKIETY.md`). Odtworzyć i zapisać do repo.
**Wymaga:** aplikacja FigCraft z dostępem do systemu plików (silnik wbudowany w CLI działa w sandboxie i nie zapisze do repo).
**Pliki:** `design/formularze-gui.figcraft` (nowy), `design/export/*.png` (zrzuty), `docs/08-implementacja/GUI-MAKIETY.md` (aktualizacja stanu).
**Kroki:**
1. Otwórz FigCraft (aplikacja), utwórz plik `design/formularze-gui.figcraft`. Strony: Fundament, Komponenty, Userflow, Ekrany telefon, Ekrany tablet, Stany i błędy, Weryfikacja.
2. Zmienne: kolekcja `Theme` (tryby Light, Dark) z kolorami z `design/tokens.css` (`variable.import` z `design/tokens.json`), `Scale` (odstępy, promienie), `Lang` (PL, EN) z tekstami z `apps/web/messages/{pl,en}/*.json` (klucze `<plik>/<klucz>`).
3. Komponenty i ekrany buduj z zaimplementowanej aplikacji (odwzorowanie wsteczne ułatwia zgodność): uruchom `npm run dev` w `apps/web`, zrób zrzuty tras przy 390 i 820 px w obu motywach i językach i zbuduj ramki według `GUI-MAKIETY.md` (25 komponentów, 10 widoków telefonu, 8 tabletu, 8 stanów błędów, diagram userflow, nowe ekrany: Źródło, Przegląd, Uwaga (arkusz), Wsad, Wartości testowe, Otwórz PDF + JSON).
4. Każdy widok w czterech wariantach (Light·PL, Dark·PL, Light·EN, Dark·EN) przez tryby zmiennych na ramkach.
5. Zapisz plik w repo (commit) i wyeksportuj PNG ekranów do `design/export/`.
**Kryteria odbioru:** plik `.figcraft` w Git, każdy widok z tabeli w `GUI-MAKIETY.md` ma ramkę w 4 wariantach, eksport PNG obecny; `GUI-MAKIETY.md` nie twierdzi już, że makiety są utracone.

---

## Z11 — Porządki w dokumentacji i narzędziach

**Cel:** usunąć rozjazdy i drobne długi.
**Wymaga:** nic.
**Kroki:**
1. `scripts/verify_docs.py` przeszukuje `.venv` i zgłasza martwe linki z bibliotek. Dodaj pomijanie katalogów `.venv` (obok istniejącego `node_modules`) wraz z testem w `tests/` i uruchom `pytest -q`.
2. Raporty workerów `docs/08-implementacja/RAPORT-W3B.md` i `RAPORT-W3I.md`: przenieś istotną treść (kontrakt `putResult/getResult`, ograniczenia) do `apps/web/README.md`, a raporty usuń; zaktualizuj linki.
3. `docs/README.md`: dodaj linki do `GUI-MAKIETY.md`, tego pliku i `apps/web/README.md`.
4. `docs/superpowers/plans/2026-11-22-gui-next.md` i `specs/*`: ustaw `status` zgodnie ze stanem, odhacz wykonane.
5. `docs/07-decyzje/ADR-002-gui-nextjs.md`: zmień status na „przyjęta, wdrożona częściowo”, dopisz rzeczywiste konsekwencje (Node w runtime, brak eksportu statycznego, obejście `sharp`).
6. `CHANGELOG.md`: uporządkuj sekcję „Niewydane” (jedna pozycja na funkcję).
**Kryteria odbioru:** `python3 scripts/verify_docs.py` zielone także z `.venv` w katalogu repo; `pytest -q` i `ruff` zielone.

---

## Z12 — Dopracowanie wizualne i jakość tekstów

**Cel:** zgodność z makietami i dobre PL/EN.
**Wymaga:** najlepiej po Z10 (porównanie z plikiem), ale można zacząć od opisu `GUI-MAKIETY.md`.
**Pliki:** komponenty w `apps/web/src/design-system/**`, `apps/web/messages/{pl,en}/*.json`, `apps/web/scripts/screenshots.mjs` (nowy; zrzuty do `apps/web/test-results/screens/`, katalog ignorowany).
**Kroki:**
1. Skrypt zrzutów: dla każdej trasy w 4 wariantach (motyw × język) i szerokościach 390 i 820 zapisuje PNG (dane przez katalog `/design-system` lub fixture); użyj do przeglądu.
2. Znane braki: `ValidationList` na telefonie powinna być listą kart zamiast tabeli (<768 px); zakładki wyniku mają wariant linku z `aria-current` (zachowaj, ale wizualnie jak w makietach: aktywna pogrubiona i podkreślona); wskaźnik statusu API w pasku (kolory ok/degraded/unavailable zgodnie z tokenami); długie etykiety PL (np. „Przegląd wszystkich pól”) nie mogą się przycinać przy 390 px.
3. Teksty: przegląd wszystkich kluczy PL i EN pod kątem terminologii (spójność: „Wczytaj”/„Upload”, „Kolejka”, „Wynik”, „Walidacja”, „Podgląd”), brak mieszania języków, poprawne znaki polskie; `<html lang>` zgodny z trasą; `<title>` i `description` per trasa (next-intl `generateMetadata`).
4. Test regresji: e2e sprawdzający brak przycięcia (`scrollWidth <= clientWidth`) dla przycisków i zakładek w PL przy 390 px.
**Kryteria odbioru:** zrzuty przejrzane i dołączone do PR (telefon i tablet, jasny i ciemny, PL i EN); testy zielone.

---

## Znane ograniczenia (bez osobnego zadania)

- Mock `/validate` zwraca strukturę odpowiedzi, ale nie powiela walidatorów PL z Pythona (patrz Z9).
- Wyniki i kolejka żyją w pamięci karty (odświeżenie czyści); trwałość (IndexedDB) nie jest planowana.
- Etap nie obejmuje widoku desktopowego (treść ma maksymalną szerokość 640 px obok szyny).
- Interfejs `/review/` w `src/formgen/static/review/` pozostaje osobnym narzędziem do czasu zakończenia Z1.
