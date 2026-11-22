# Generator formularzy — aplikacja webowa

Aplikacja Next.js (App Router), React i TypeScript strict: wejście w panelu uploadu (kolejka analizy, szczegóły plików, dziennik aktywności API), wsad `/batch`, wynik JSON, walidacja, podgląd e-usługi, otwieranie lokalnego JSON i ustawienia. Domyślnie działa z prawdziwym API (tryb `live` przez proxy samego originu); mock MSW tylko na wyraźną zmienną. Weryfikacja, edycja i raport uwag W3c pozostają do implementacji.

Wymagany Node.js 22.22.2+, 24.15.0+ lub ≥26 i npm (ograniczenie narzędzi testowych). Wszystkie wersje zależności są przypięte w `package.json` i `package-lock.json`.

```sh
cd apps/web
npm ci
npm run dev
```

Adres startowy: `http://localhost:3000/pl`. Język jest w adresie (`/pl`, `/en`), a przełącznik zapisuje także preferencję `formgen.locale` w localStorage. Domyślny język wejścia przez `/` to polski. Motyw (`Light`, `Dark`, `System`) zapisuje się jako `formgen.theme`; skrypt w nagłówku ustawia `data-theme` przed malowaniem strony. Czcionki Inter i Source Code Pro pochodzą z lokalnych pakietów Fontsource; aplikacja nie korzysta z CDN.

## Trasy i przepływ

Każda trasa ma prefiks `/pl` lub `/en`:

| Trasa                      | Zawartość                                         |
| -------------------------- | ------------------------------------------------- |
| `/login`                   | Token JWT lub kontynuacja bez logowania           |
| `/upload`                  | Wybór plików, kolejka i szczegóły                 |
| `/batch`                   | Wsad do 20 plików jednym żądaniem                 |
| `/results/[id]/json`       | Kolorowany, zwijany JSON; kopiowanie i pobieranie |
| `/results/[id]/validation` | Walidacja struktury i przykładowych wartości      |
| `/results/[id]/preview`    | Interaktywny podgląd i warunki JSONata            |
| `/open`                    | Import JSON z dysku bez analizy API               |
| `/settings`                | Język, motyw, token, formaty i scenariusz mocka   |
| `/design-system`           | Katalog komponentów i przykłady                   |

Po dodaniu plików wybierz „Analizuj wszystko”. Żądania idą kolejno; pojedynczy plik po sukcesie otwiera JSON automatycznie. Gotowy wiersz i szczegóły udostępniają wynik, podgląd i pobieranie JSON. „Wynik” w powłoce otwiera ostatnio oglądany wynik, a przed pierwszym wynikiem prowadzi do uploadu. Wyniki i pozostałe ekrany korzystają z tej samej responsywnej powłoki i statusu systemu.

`features/results/store.ts` jest jedynym magazynem wyników: `{ id, form, meta, sourceFile?, source: 'api' | 'local' }`. Analiza publikuje przez `putResult`, a import lokalny tworzy identyfikator `local-*`. Trasy subskrybują `getResult` przez `useResult`. `features/upload/store.ts` przechowuje pliki, statusy, błędy i `resultId`, bez kopii formularza. Usunięcie wiersza nie usuwa opublikowanego wyniku. Wszystko żyje w pamięci karty; odświeżenie strony usuwa kolejkę i wyniki.

401 z analizy, formatów albo walidacji usuwa token i kieruje do `/login?reason=401&returnTo=...`. Wspólny mechanizm akceptuje wyłącznie wewnętrzne trasy; logowanie wraca do poprzedniego widoku nawigacją klienta, zachowując kolejkę i wyniki. API nie ujawnia flagi auth, więc obecność tokenu sama w sobie nie blokuje tras.

## API

Opcjonalna konfiguracja `.env.local` (wzór: `.env.example`):

```dotenv
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_BASE=
```

Tryb `live` jest domyślny (także w `dev`); `mock` włącza się wyłącznie jawną zmienną `NEXT_PUBLIC_API_MODE=mock` i uruchamia MSW w przeglądarce przed renderowaniem zawartości. E2e domyślnie używa mocka; `PLAYWRIGHT_API_MODE=live` uruchamia je na prawdziwym backendzie. Zmienne `NEXT_PUBLIC_API_BASE` adresuje backend wprost, a puste pole oznacza API pod tym samym origin: `next.config.ts` przekazuje proxy `/health`, `/ready` i `/api/:path*` na `API_INTERNAL_URL` (domyślnie `http://127.0.0.1:8001`), więc ten sam origin nie wymaga CORS ani udostępniania nagłówków `X-*`.

Klient: `src/lib/api/index.ts`. Metody: `health`, `ready`, `formats`, `analyze`, `analyzeBatch`, `validate`. Hooki TanStack Query: `useHealth`, `useReady`, `useFormats`, `useAnalyze`, `useValidate`. Token: `tokenStore.get()/set()`, klucz `formgen.token` w localStorage, nagłówek `Authorization: Bearer`. Nie zapisuj prawdziwych tokenów w repo.

`analyze` zwraca `{form, metadata}`; metadane mają klucze `processingTimeMs`, `detectedType`, `warnings`, `extractor`, `partialResult`, `partialReasons` (z nagłówków `X-Partial-Result` i `X-Partial-Reasons`). Brak nagłówka daje `null`. Każde żądanie klienta trafia do dziennika aktywności (`src/lib/api/activity.ts`), widocznego w panelu uploadu jako „Aktywność API”. `/ready` zachowuje poprawną treść ze statusem `unavailable` również przy HTTP 503. Pozostałe błędy HTTP są `ApiError` z `code`, `status`, `message`, `details`, `hasEnvelope`. Brak koperty daje `HTTP_ERROR` i komunikat `HTTP <status>`; awaria sieci `NETWORK_ERROR`, niezgodna odpowiedź `INVALID_RESPONSE`. Anulowanie zachowuje `AbortError`.

## Wsad

`/batch` wysyła do 20 plików jednym żądaniem `POST /api/v1/forms/analyze-batch` (`features/batch`). Każdy plik dostaje wiersz ze statusem i `error.code`; „Otwórz wynik” publikuje wynik przez `putResult` i otwiera podgląd, a „Ponów” wysyła odrzucony plik pojedynczo przez `/analyze`.

## Scenariusze mocka

`src/mocks/scenarios.ts` udostępnia `scenarios`, `getMockScenario()` i `setMockScenario()`. Ustawienie jest utrwalane jako `formgen.mockScenario`; korzystają z niego Ustawienia. `auto` wybiera scenariusz z nazwy, pozostałe ustawienia mają pierwszeństwo. Można wybrać każdy kod błędu API, `success`, `degraded`, `detail` (422 bez koperty) i `plain-500`.

| Fragment nazwy            | Wynik                       |
| ------------------------- | --------------------------- |
| `413`                     | FILE_TOO_LARGE              |
| `415`                     | UNSUPPORTED_MEDIA_TYPE      |
| `mime`                    | MIME_MISMATCH               |
| `401`                     | UNAUTHORIZED                |
| `timeout`                 | PROCESSING_TIMEOUT          |
| `503`                     | MODEL_UNAVAILABLE           |
| `invalid-output`          | INVALID_OUTPUT              |
| `degraded`                | sukces z HeuristicExtractor |
| `auth-misconfigured`      | AUTH_MISCONFIGURED          |
| `missing-file`            | MISSING_FILE                |
| `too-many-files`          | TOO_MANY_FILES              |
| `invalid-form-definition` | INVALID_FORM_DEFINITION     |
| `invalid-sample-values`   | INVALID_SAMPLE_VALUES       |
| `detail`, `plain-500`     | błędy bez koperty           |

Nazwa >250 znaków lub zawierająca zakazane znaki daje INVALID_FILENAME. Pusty plik daje MISSING_FILE; niedozwolone rozszerzenie i rozmiar >25 MiB są sprawdzane. Sukces zwraca przykład nieruchomości, a nazwa z `05` lub `nadplata` przykład nadpłaty. `analyze-batch` ma limit 10 plików i oddzielne wyniki. Mock `/validate` sprawdza strukturę wejścia, a odpowiedzi biznesowe są deterministycznymi scenariuszami; nie zastępuje walidatorów Pythona.

## Synchronizacja i kontrole

W katalogu głównym, jeżeli brakuje `data/input`, uruchom `python3 scripts/sync_materials.py`. Następnie:

```sh
cd apps/web
npm run sync:tokens
npm run sync:fixtures
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run e2e
```

Skrypty synchronizacji kopiują oryginały bez modyfikacji; test sprawdza ich identyczność. Tokeny pochodzą z `design/tokens.css`, przykłady z `data/input/02_przyklady_json/*.json` (łącznie ze schematem importu). Schemat importu nie jest formularzem i nie jest zwracany przez mock. Test i18n sprawdza klucze wszystkich katalogów JSON oraz ich obecność w konfiguracji. Nowy plik tłumaczeń należy dodać do `src/i18n/messages.ts` w obu językach.

Vitest używa MSW Node; e2e Chromium uruchamia osobny serwer na porcie 3100 (alternatywnie `PLAYWRIGHT_PORT=3113 npm run e2e`). Pełny zestaw obejmuje katalog oraz przepływ logowanie → upload fixture → kolejka → JSON → walidacja z błędami → podgląd ze zmianą osoby → lokalny JSON → ustawienia → powrót do wyniku: PL/EN, 390/820 px, jasny/ciemny. Oddzielna macierz sprawdza 413/415/504 z ponowieniem i 401 z zachowaniem kolejki oraz powrotem do walidacji; kontroluje konsolę i żądania poza localhost. Zrzuty i ślady błędów trafiają do ignorowanego `test-results/`. Przed commitem w katalogu głównym uruchom także `python3 scripts/verify_docs.py`. Pełny spis licencji pozostaje zadaniem W4; pakiety Fontsource zawierają czcionki na licencji OFL-1.1 (osadzane lokalnie).

Optymalizacja obrazów Next.js jest wyłączona (`images.unoptimized`). Opcjonalny `sharp` zastępuje jawny lokalny pakiet `@formgen/disabled-sharp` przez npm `overrides`, aby instalacja nie pobierała libvips na LGPL. Źródło to `scripts/disabled-sharp`, a pakiet lokalny powstaje przez `npm run pack:disabled-sharp` (archiwum jest w repo i ma skrót w lockfile; omija problem npm z override na katalog). Próba uruchomienia optymalizatora kończy się czytelnym błędem; wprowadzając obrazy, używaj zwykłych plików lokalnych. Biblioteki `lightningcss` (1.33.0) oraz `axe-core` (4.14.1, przez ESLint) mają MPL-2.0 i są używane jako niezmodyfikowane, oddzielne zależności narzędziowe. Nie są kodem aplikacji wysyłanym do przeglądarki.
