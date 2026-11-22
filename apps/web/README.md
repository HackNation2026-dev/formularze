# Generator formularzy — aplikacja webowa

Fundament aplikacji Next.js (App Router), React i TypeScript strict. Widoki są zaślepkami `TODO W3`; gotowe są routing PL/EN, preferencje motywu, klient API i mocki. Komponenty i logika funkcji powstaną w kolejnych zadaniach.

Wymagany Node.js 22.22.2+, 24.15.0+ lub ≥26 i npm (ograniczenie narzędzi testowych). Wszystkie wersje zależności są przypięte w `package.json` i `package-lock.json`.

```sh
cd apps/web
npm ci
npm run dev
```

Adres startowy: `http://localhost:3000/pl`. Język jest w adresie (`/pl`, `/en`), a przełącznik zapisuje także preferencję `formgen.locale` w localStorage. Domyślny język wejścia przez `/` to polski. Motyw (`Light`, `Dark`, `System`) zapisuje się jako `formgen.theme`; skrypt w nagłówku ustawia `data-theme` przed malowaniem strony. Czcionki Inter i Source Code Pro pochodzą z lokalnych pakietów Fontsource; aplikacja nie korzysta z CDN.

## API

Opcjonalna konfiguracja `.env.local` (wzór: `.env.example`):

```dotenv
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_BASE=
```

Tryb `mock` uruchamia MSW w przeglądarce przed renderowaniem zawartości. Jest domyślny w `dev` i jawnie włączany w e2e. Produkcyjny build bez konfiguracji używa `live`. Zmienne `NEXT_PUBLIC_*` są wbudowywane podczas kompilacji, więc zmiana wymaga nowego builda. W `live` ustaw `NEXT_PUBLIC_API_MODE=live` i adres lokalnego backendu w `NEXT_PUBLIC_API_BASE` (lub zostaw pusty, jeżeli API jest dostępne pod tym samym origin). Oddzielny origin wymaga CORS i udostępnienia nagłówków `X-*` po stronie serwera.

Klient: `src/lib/api/index.ts`. Metody: `health`, `ready`, `formats`, `analyze`, `analyzeBatch`, `validate`. Hooki TanStack Query: `useHealth`, `useReady`, `useFormats`, `useAnalyze`, `useValidate`. Token: `tokenStore.get()/set()`, klucz `formgen.token` w localStorage, nagłówek `Authorization: Bearer`. Nie zapisuj prawdziwych tokenów w repo.

`analyze` zwraca `{form, metadata}`; metadane mają klucze `processingTimeMs`, `detectedType`, `warnings`, `extractor`. Brak nagłówka daje `null`. `/ready` zachowuje poprawną treść ze statusem `unavailable` również przy HTTP 503. Pozostałe błędy HTTP są `ApiError` z `code`, `status`, `message`, `details`, `hasEnvelope`. Brak koperty daje `HTTP_ERROR` i komunikat `HTTP <status>`; awaria sieci `NETWORK_ERROR`, niezgodna odpowiedź `INVALID_RESPONSE`. Anulowanie zachowuje `AbortError`.

## Scenariusze mocka

`src/mocks/scenarios.ts` udostępnia `scenarios`, `getMockScenario()` i `setMockScenario()`. Ustawienie jest utrwalane jako `formgen.mockScenario`; to interfejs dla przyszłych Ustawień W3. `auto` wybiera scenariusz z nazwy, pozostałe ustawienia mają pierwszeństwo. Można wybrać każdy kod błędu API, `success`, `degraded`, `detail` (422 bez koperty) i `plain-500`.

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

Vitest używa MSW Node; e2e Chromium uruchamia osobny serwer na porcie 3100. Przed commitem w katalogu głównym uruchom także `python3 scripts/verify_docs.py`. Pełny spis licencji pozostaje zadaniem W4; pakiety Fontsource zawierają czcionki na licencji OFL-1.1 (osadzane lokalnie).

Optymalizacja obrazów Next.js jest wyłączona (`images.unoptimized`). Opcjonalny `sharp` zastępuje jawny lokalny pakiet `@formgen/disabled-sharp` przez npm `overrides`, aby instalacja nie pobierała libvips na LGPL. Źródło to `scripts/disabled-sharp`, a pakiet lokalny powstaje przez `npm run pack:disabled-sharp` (archiwum jest w repo i ma skrót w lockfile; omija problem npm z override na katalog). Próba uruchomienia optymalizatora kończy się czytelnym błędem; wprowadzając obrazy, używaj zwykłych plików lokalnych. Biblioteki `lightningcss` (1.33.0) oraz `axe-core` (4.14.1, przez ESLint) mają MPL-2.0 i są używane jako niezmodyfikowane, oddzielne zależności narzędziowe. Nie są kodem aplikacji wysyłanym do przeglądarki.
