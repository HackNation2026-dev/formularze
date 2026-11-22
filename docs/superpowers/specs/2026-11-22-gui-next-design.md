---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: do realizacji (zlecone użytkownika 2026-11-22)
---

# Aplikacja GUI (Next.js) — projekt

## Cel
Pełna aplikacja webowa „Generator formularzy”: upload formularzy, kolejka analiz, wynik (JSON, walidacja, podgląd e-usługi), ustawienia. Na tym etapie na mock API zgodnym z kontraktem backendu. Źródła prawdy: `docs/08-implementacja/GUI-MAKIETY.md` (widoki, stany, komponenty), `design/tokens.css` (paleta, skala), `docs/08-implementacja/FRONTEND-BRIEF.md` (zachowania), `src/formgen/api/` (kontrakt API), `src/formgen/schema/model.py` (FormDefinition).

## Zakres
- Wszystkie widoki i pełny userflow z `GUI-MAKIETY.md`: logowanie, upload i kolejka, szczegóły pliku (arkusz na telefonie, panel boczny na tablecie), wynik JSON, walidacja, podgląd e-usługi ze stanami dynamicznymi, otwórz JSON, ustawienia, stany błędów i pustki.
- Mobile-first: telefon (≥360 px) i tablet (≥768 px); bez osobnego układu desktopowego (na szerokich ekranach treść ma maksymalną szerokość).
- Motyw jasny/ciemny/systemowy, język PL/EN (przełączane w Ustawieniach i w nagłówku), preferencje w `localStorage`.
- Mock API (MSW) z scenariuszami błędów; tryb `live` do prawdziwego API przez zmienną środowiskową.

## Poza zakresem
Konta, historia na serwerze, panel administracyjny, Docker i compose dla `apps/web`, zmiany w kodzie Pythona i w `src/formgen/static/review/`.

## Stos (wersje przypięte przy instalacji, `--save-exact`, `package-lock.json`)
Next.js (App Router) + React + TypeScript strict; Tailwind CSS v4; TanStack Query, Table, Form; next-intl; jsonata; zod (walidacja odpowiedzi API); MSW; Vitest + Testing Library; Playwright; ESLint + Prettier. Czcionki Inter i Source Code Pro z pakietów `@fontsource*` (offline, bez CDN).

## Struktura `apps/web/`
```
apps/web/
  package.json, tsconfig.json, next.config.ts, eslint, prettier, vitest, playwright
  scripts/sync-tokens.mjs        kopiuje design/tokens.css do src/styles/tokens.generated.css
  messages/{pl,en}/<feature>.json  katalogi tłumaczeń per funkcja
  src/app/[locale]/...           trasy (App Router)
  src/design-system/             atomic design (każdy komponent: plik, test, wpis w katalogu)
    atoms/       Button, IconButton, Icon, Text, Link, Divider, TextInput, Textarea, Select, Checkbox, Radio,
                 Badge, Spinner, ProgressBar, Skeleton, Kbd, VisuallyHidden
    molecules/   FormField, ChoiceGroup, Tab, NavItem, KeyValue, Toast, StatusChip, Chip, SegmentedControl,
                 StepIndicator, EmptyState, FileRow, ValidationItem, Callout
    organisms/   AppBar, BottomNav, SideRail, Dropzone, FileQueue (TanStack Table), JsonViewer, ValidationList,
                 FormRenderer, BottomSheet, SidePanel, SettingsPanel, LoginForm (TanStack Form)
    templates/   AppShell, AuthLayout, MasterDetail, ResultLayout
    tokens/      tokens.generated.css (z design/tokens.css), theme.ts
  src/features/{auth,upload,results,preview,settings,open-json,system}/   logika funkcji (hooki, store, mapowanie), bez UI
  src/app/[locale]/design-system/   żywy katalog: tokeny (kolory Light/Dark, typografia, odstępy), każdy atom, molekuła,
                                    organizm i szablon we wszystkich stanach, przełączniki motywu i języka
  src/lib/api/                   klient, typy, zod, błędy, hooki TanStack Query
  src/lib/preview/               silnik stanów JSONata i mapowanie typów pól
  src/mocks/                     MSW: handlers, scenariusze, fixtures (z data/input/02_przyklady_json)
  e2e/                           testy Playwright
```

## Trasy (z prefiksem języka `/pl`, `/en`)
`/design-system` (katalog), `/login`, `/upload` (dropzone, kolejka, panel szczegółów), `/results/[id]/json`, `/results/[id]/validation`, `/results/[id]/preview`, `/open` (JSON z dysku, bez API), `/settings`, `not-found`, `error`. Ochrona tras: bez tokenu przy włączonym auth przekierowanie do `/login` z zachowaniem kolejki; 401 z API wraca do `/login`.

## Dane i API
Kontrakt (z `src/formgen/api/app.py`): `GET /health`, `GET /ready` (status ok|degraded|unavailable, 503 przy unavailable), `GET /api/v1/formats`, `POST /api/v1/forms/analyze` (multipart `file`; nagłówki `X-Processing-Time-Ms`, `X-Detected-Type`, `X-Warnings`, `X-Extractor`), `POST /api/v1/forms/analyze-batch`, `POST /api/v1/forms/validate` (`sample_values`, odpowiedź `valid`, `errors`, `warnings`, `sample_errors`, `sample_unknown`). Koperta błędu `{"error": {code, message, ...}}`; odpowiedzi bez koperty (`{"detail": ...}`, zwykłe 500) pokazują ogólny błąd ze statusem. Kody: `FILE_TOO_LARGE` 413, `TOO_MANY_FILES` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `MIME_MISMATCH` 415, `INVALID_FILENAME` 400 (nazwa >250 znaków lub znaki `; : < > / \ | ' * % $`), `MISSING_FILE` 400, `UNAUTHORIZED` 401, `PROCESSING_TIMEOUT` 504, `MODEL_UNAVAILABLE` 503, `INVALID_OUTPUT` 500, `AUTH_MISCONFIGURED` 500, `INVALID_FORM_DEFINITION` i `INVALID_SAMPLE_VALUES` 422.
Kolejka wysyła pliki do `/analyze` po kolei (jeden aktywny); `analyze-batch` jest opcjonalny. Wynik zdegradowany (200 z `X-Extractor: HeuristicExtractor`) pokazuje komunikat informacyjny.
Stan klienta: serwerowy w TanStack Query; kolejka i wyniki w pamięci (store w `features/upload`), token, język i motyw w `localStorage`.

## Mock API
MSW działa w przeglądarce (dev) i w Node (Vitest). Zmienne: `NEXT_PUBLIC_API_MODE=mock|live`, `NEXT_PUBLIC_API_BASE`. Scenariusz wybierany nazwą pliku (`*413*`, `*415*`, `*mime*`, `*401*`, `*timeout*`, `*503*`, `*invalid-output*`, `*degraded*`, nazwa >250 znaków) oraz w Ustawieniach w trybie mock („Scenariusz API”). Domyślnie sukces: zwraca fixture z `data/input/02_przyklady_json` (kopiowane do `src/mocks/fixtures/`, ze skryptem synchronizacji i testem zgodności).

## Design system (atomic design)
Komponenty tylko z katalogu `src/design-system/` w czterech warstwach (atomy, molekuły, organizmy, szablony); strony składają szablony i organizmy. Zasady: atom nie importuje z wyższej warstwy; każdy komponent ma typowane propsy, stany (default, hover, focus, disabled, error, loading tam, gdzie dotyczy), test Vitest i wpis w katalogu `/design-system`; kolory i odstępy wyłącznie przez tokeny (klasy Tailwind z `@theme`), bez wartości surowych; teksty przez next-intl (komponenty wizualne dostają treść przez propsy). Katalog jest jedynym miejscem przeglądu systemu (bez Storybooka, bez dodatkowych narzędzi).

## Przepływ weryfikacji (wynika z API i z `/review/`)

Źródła: `src/formgen/api/app.py` (`/analyze-batch`, `/validate` z `sample_values`, `/ready` degraded) oraz istniejące UI `src/formgen/static/review/` (zachowanie do odwzorowania w nowej aplikacji, bez kopiowania kodu). Szkice w FigCraft: `Phone/ResultSource`, `Phone/ReviewFields`, `Tablet/ReviewSplit` (sesja ulotna, opis poniżej jest wiążący).

Przepływ: Wczytaj lub Otwórz (PDF źródłowy + JSON, bez API) → Wynik → zakładka **Źródło** (PDF obok pól; strony, tekst strony) → zakładka **Przegląd** (tryb „Przegląd wszystkich pól”, także ukrywanych warunkowo, albo „Symulacja” z odpowiedziami i warunkami JSONata) → przy polu: **edycja** (zmiana tytułu, zmiana typu z listy `typeChoices`, usunięcie z domknięciem luki w siatce), **uwaga do pola**, **zgłoszenie brakującego pola** (uwaga z lokalizacją „strona/miejsce w PDF”) → **Waliduj strukturę** (`/validate`) i **Waliduj wartości** (`sample_values` → `sample_errors`, `sample_unknown`) → **Pobierz czysty JSON** (`konfiguracja-<sha12>.json`) i **Pobierz raport uwag** (`raport-<sha12>.json`).

Raport (zgodny z `/review/`): `reportVersion: 2`, `configurationSha256`, `baseConfigurationSha256`, `editedByClerk`, `edits` (wpisy `rename` {techName, from, to}, `retype` {techName, from, to}, `delete` {techName, removed[]}), `hashMethod` (SHA-256 z JSON UTF-8 z posortowanymi kluczami obiektów i zwartymi separatorami, kolejność tablic zachowana), `configurationTitle`, `provenance`, `sourcePdfName`, `createdAt`, `annotations` (`kind` `field` lub `missing`, `field` {title, techName, key, deleted}, `location`, `text`). Uwagi podążają za żywym polem (po edycji aktualizują `key`, po usunięciu `deleted: true`). Uwagi i edycje żyją w pamięci karty; przed wczytaniem innej konfiguracji aplikacja ostrzega o niezapisanym raporcie.

Wsad: pliki do `/analyze-batch` (maks. `max_batch_files`, domyślnie 20; powyżej `TOO_MANY_FILES` 413), przetwarzane po kolei; odpowiedź `results[]` z `filename`, `status`, `form` albo `error`, oraz `ok` i `failed`. Widok „Pliki wsadu”: podsumowanie („18 z 20 gotowych”), wiersze z wynikiem lub błędem (`Otwórz`, `Ponów`), dodawanie kolejnych plików. Pojedyncze pliki z kolejki nadal idą do `/analyze` po kolei.

Dodatkowe trasy: `/results/[id]/source`, `/results/[id]/review`, `/batch`. `/open` przyjmuje PDF źródłowy i JSON naraz.

## Wymagania jakościowe
Dostępność WCAG AA (kontrast z tokenów, fokus, role ARIA, cele dotykowe ≥ 44 px, obsługa klawiatury); brak surowych kolorów poza tokenami; wszystkie teksty UI w katalogach PL/EN (test: te same klucze w obu językach); brak CDN i zewnętrznych żądań w runtime; brak sekretów w repo; HTML z opisów FormDefinition czyszczony przed `dangerouslySetInnerHTML` (usunięcie `<script>`, atrybutów `on*`, `javascript:`).

## Kryteria ukończenia
`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run e2e` przechodzą w `apps/web`; `python3 scripts/verify_docs.py` i `pytest` w katalogu głównym bez nowych błędów; każdy widok z `GUI-MAKIETY.md` ma trasę i test; pełny userflow ma test e2e; spis licencji zależności; CI dla `apps/web`.
