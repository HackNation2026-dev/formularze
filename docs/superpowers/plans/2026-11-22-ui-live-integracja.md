---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: wykonany (Task 1–6; gałąź feat/web-live-integracja, przegląd końcowy przed PR)
---

# UI Live-Integracja — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, wybrany przez właściciela). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React UI (`apps/web`) w 100% na prawdziwym API: wejście od razu w panel główny, widoczne w czasie rzeczywistym wywołania API, wsad ≤20 plików, zero cichej regresji do mocków.

**Architecture:** Wyłącznie frontend: `next.config.ts` (już ma proxy `/health`, `/ready`, `/api/:path*` → `API_INTERNAL_URL`, domyślnie `127.0.0.1:8001`), `src/lib/api/client.ts`, `src/lib/mock-runtime.ts`, trasy `app/[locale]/**`, organism `ApiActivityFeed`. Backend FastAPI (`src/formgen/**`) i kontrakt — NIE ZMIENIAĆ.

**Tech Stack:** Next.js 16 / React 19 / TS strict / TanStack Query / next-intl (PL/EN) / Tailwind v4 z tokenami z `design/tokens.css`.

**Spec:** ten plan + audyt (sesja `ses_dfda73ba5ffe3pNgtZnuSXpD0V`) + `docs/08-implementacja/GUI-DO-ZROBIENIA.md` (Z1 pkt 8, Z9).

## Global Constraints

- Backend `src/formgen/**`, `compose.yaml`, `Dockerfile` — nietykalne. Tylko `apps/web/**` (i dokumentacja).
- Kolory/odstępy tylko z tokenów; teksty tylko w `apps/web/messages/{pl,en}/*.json`, te same klucze; PL i EN zawsze parzyste.
- Bez CDN i żądań zewnętrznych w runtime; kolory `#hex` zakazane w klasach.
- Commity po polsku: `feat(web): ...`, `fix(web): ...`, `docs: ...`.
- Przed oddaniem w `apps/web`: `npm run lint && npm run typecheck && npm run test` zielone.

## Review Focus

- Restart dev serwera bez `NEXT_PUBLIC_API_MODE` → aplikacja **musi zostać na live** (test w `mock-runtime.test.ts`).
- Wsad >20 plików → klient odrzuca z komunikatem, nie wysyła (test `batch` komponentu).
- Brak nagłówków `X-Partial-*` (starszy backend) → `partialResult: false`, brak błędu (test `client.test.ts`).
- `/batch` z pustą listą / błędem pojedynczego pliku → pozostałe wyniki widoczne, `error.code` pokazany (test komponentu).
- Home bez sesji → redirect do `/upload`, pętli brak (test).

---

### Task 1: Live domyślnie (koniec cichego mocka)

**Files:**
- Modify: `apps/web/src/lib/mock-runtime.ts`
- Modify: `apps/web/.env.example` (jeśli istnieje: `NEXT_PUBLIC_API_MODE=mock` → `live`)
- Test: `apps/web/src/lib/mock-runtime.test.ts` (nowy)

**Interfaces:**
- Produces: `mockEnabled = (process.env.NEXT_PUBLIC_API_MODE ?? 'live') === 'mock'`.

- [ ] **Step 1: Test failujący** — `mockEnabled` jest `false` gdy `NEXT_PUBLIC_API_MODE` nieustawione; `true` tylko przy `'mock'`.
- [ ] **Step 2:** `npx vitest run src/lib/mock-runtime.test.ts` → FAIL (obecny default zwraca true w dev).
- [ ] **Step 3:** Implementacja: `export const mockEnabled = process.env.NEXT_PUBLIC_API_MODE === 'mock';` (live bez zmiennej i w dev).
- [ ] **Step 4:** Test PASS + `npx vitest run` (całość zielona; e2e config ma własne `'mock'` — nie ruszać).
- [ ] **Step 5:** Commit `fix(web): tryb live domyślnie, mock tylko na wyraźną zmienną`.

### Task 2: Wejście w panel główny, login jako wydmuszka

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx` (Placeholder → redirect `/upload`)
- Modify: `apps/web/src/app/[locale]/login/page.tsx` (bez zmian funkcjonalnych — zostaje dostępny wprost; usunąć odnośniki do niego z nawigacji, jeśli są)
- Test: rozszerzyć istniejący test shell/placeholder lub nowy `page.test.tsx`

- [ ] **Step 1:** Test: render `/` → wywołuje redirect do `/upload` (mock `next/navigation` `redirect`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementacja: server component `redirect('/upload')` (ścieżka z prefiksem locale zgodnie z routing next-intl).
- [ ] **Step 4:** Test PASS, `npm run test` zielone.
- [ ] **Step 5:** Commit `feat(web): start w panelu uploadu, login poza ścieżką główną`.

### Task 3: Nagłówki `X-Partial-*` + dziennik aktywności API

**Files:**
- Modify: `apps/web/src/lib/api/client.ts` (metadata `analyze` + emisja zdarzeń)
- Create: `apps/web/src/lib/api/activity.ts` — `onActivity(cb)`, emit `{path, method, status, ms}` z `request()`
- Modify: `apps/web/src/features/upload/*` (callout powodów partial zamiast magicznego stringa)
- Create: `apps/web/src/design-system/organisms/ApiActivityFeed.tsx` (+ wpis w katalogu `/design-system`, linie w `index.ts`)
- Modify: `apps/web/messages/{pl,en}/{upload,shell}.json` (+ klucze `activity*`, `partialReasons`)
- Test: `client.test.ts` (partial), `activity.test.ts`, `ApiActivityFeed.test.tsx`

**Interfaces:**
- Produces: `AnalyzeResult.metadata.partialResult: boolean`, `partialReasons: string[]`; `subscribeActivity(listener): () => void`.

- [ ] **Step 1:** Testy failujące: parsing `X-Partial-Result: true` → `partialResult:true`; `X-Partial-Reasons: extractor-fallback:LlmUnavailable` → `['extractor-fallback:LlmUnavailable']`; brak nagłówków → `false, []`. Emisja zdarzenia z `request()` dla GET/POST.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementacja: w `analyze()` czytać nagłówki; `activity.ts` z listenerem (prosty moduł, max 50 zdarzeń w buforze); `ApiActivityFeed`: lista ostatnich wywołań (ścieżka, metoda, status, ms) z `role="log"`, aria-live polite.
- [ ] **Step 4:** Testy PASS, lint/typecheck.
- [ ] **Step 5:** Commit `feat(web): powody degradacji z nagłówków X-Partial i dziennik aktywności API`.

### Task 4: Wsad `/batch` (Z1 pkt 8)

**Files:**
- Create: `apps/web/src/app/[locale]/batch/page.tsx`
- Create: `apps/web/src/features/batch/useBatch.ts` (+ test)
- Modify: `apps/web/src/mocks/handlers.ts` (limit 10 → 20 dla spójności)
- Modify: `apps/web/src/design-system/templates/AppShell/Connected.tsx` (pozycja nawigacji `batch`)
- Modify: `apps/web/messages/{pl,en}/batch.json`, rejestracja w `src/i18n/messages.ts`
- Test: `useBatch.test.ts`, test trasy

**Interfaces:**
- Consumes: `api.analyzeBatch(files)`, `putResult(id, {form, source:'batch'})`, `MAX_BATCH_FILES = 20`.
- Produces: hook `useBatch()` → `{files, addFiles, run, retryOne, openResult}`.

- [ ] **Step 1:** Testy: `addFiles` powyżej 20 odrzuca nadmiar z komunikatem; `run` wywołuje `analyzeBatch` raz; wiersz błędu pokazuje `error.code`; „Otwórz" robi `putResult` + nawigację do `/results/<id>/preview`; `retryOne` wysyła pojedynczy plik przez `analyze`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementacja trasy i hooka (stany: kolejka → gotowe/błąd per plik z odpowiedzi batch).
- [ ] **Step 4:** Testy PASS, `npm run lint && npm run typecheck && npm run test`.
- [ ] **Step 5:** Commit `feat(web): wsad do analyze-batch z listą statusów per plik`.

### Task 5: Walidacja — niepokazywanie pustej listy przy `sample_unknown`

**Files:**
- Modify: `apps/web/src/design-system/templates/ResultLayout/ResultView.tsx` (warunek `ValidationList` ~linia 124–127)
- Test: rozszerzyć `results.test.tsx`

- [ ] **Step 1:** Test: `sample_unknown` niepuste, `errors/warnings/sample_errors` puste → lista się nie renderuje, callout jest.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implementacja. **Step 4:** PASS. **Step 5:** Commit `fix(web): pusta lista walidacji nie myli przy sample_unknown`.

### Task 6: E2E live profil + dokumentacja

**Files:**
- Modify: `apps/web/playwright.config.ts` (tryb live przez `PLAYWRIGHT_API_MODE=live` zamiast hardcodowanego mocka; live wymaga backendu na `API_INTERNAL_URL`)
- Modify: `apps/web/README.md` (sekcja: live przez proxy, `e2e:live`, zmienne)
- Modify: `docs/08-implementacja/GUI-DO-ZROBIENIA.md` (odhaczyć Z1 pkt 8, P1 audytu; dopisać stan)
- Modify: `CHANGELOG.md` (sekcja „Niewydane")

- [ ] **Step 1:** `PLAYWRIGHT_API_MODE=mock npm run e2e` (całość, w tym nowa `/batch`) — zielone na mockach.
- [ ] **Step 2:** Smoke live: dev serwer `:3000` z Task 3/4 działa na `:8001` — ręczny curl `POST /api/v1/forms/analyze-batch` przez `:3000` z 2 plikami PDF → 200, wiersze w UI.
- [ ] **Step 3:** `python3 scripts/verify_docs.py` (dokumentacja spójna).
- [ ] **Step 4:** Commit `docs(web): profil e2e live i aktualizacja stanu GUI`.

## Po wykonaniu — weryfikacja całości

- `apps/web`: `npm ci` zbędne (zainstalowane), `npm run lint && npm run typecheck && npm run test` zielone.
- Live demo: `:3000` (dev, `NEXT_PUBLIC_API_MODE=live`) + `:8001` (api+llm+tika) → upload PDF → kolejka → wynik → walidacja → `/batch` z kilkoma plikami; `ApiActivityFeed` pokazuje `/health`, `/formats`, `/analyze`, `/validate`.
- Backend: `git diff origin/main -- src/formgen compose.yaml Dockerfile` — pusty.
