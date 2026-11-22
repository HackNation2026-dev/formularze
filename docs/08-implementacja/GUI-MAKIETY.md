---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: opis i tokeny w repo; sesja FigCraft z makietami utracona (restart silnika 2026-11-22)
---

# Makiety GUI (FigCraft)

Projekt: [specyfikacja](../superpowers/specs/2026-11-21-makiety-gui-design.md), plan: [plan wdrożenia](../superpowers/plans/2026-11-21-makiety-gui.md). Tokeny: `design/tokens.css` (Tailwind v4) i `design/tokens.json`. Test kontrastu: `tests/test_gui_tokens.py`.

## Stan i ograniczenia

- Makiety (6 stron, 25 komponentów, 18 ekranów w 4 wariantach) istniały w sesji FigCraft `formularze-gui` i zostały **utracone** po restarcie silnika FigCraft 2026-11-22: silnik nie zapisuje do repo, a plik `.figcraft` nigdy nie trafił do Git. Ten dokument, `design/tokens.*` i test to jedyne zachowane źródło; kod `apps/web/` odtwarza widoki z opisu. Nowy przepływ weryfikacji ma tylko szkice (3 ekrany w nowej, też ulotnej sesji).
- Opisy ramek poniżej (stany, prototyp, warianty) potwierdził autor na zrzutach z sesji; do czasu zapisania pliku nie da się ich sprawdzić z samego repo. Z repo sprawdzają się tylko tokeny (`tests/test_gui_tokens.py`).
- `design/tokens.json` zawiera kolekcje `Theme` i `Scale` i powstaje z `design/tokens.css` skryptem `scripts/gui_tokens_from_css.py`. Typografię (Inter, Source Code Pro, style `Text/*`) opisuje ta sekcja, bez pliku; `Lang` jest tylko w FigCraft.
- Teksty interfejsu (około 125 par PL/EN) są w kolekcji zmiennych `Lang`, bez eksportu do repo. Klucze mają prefiksy: `login/`, `upload/`, `queue/`, `details/`, `val/`, `prev/`, `load/`, `set/`, `st/`, `nav/`, `tab/`, `badge/`, `btn/`, `row/`, `field/`.
- Dane przykładowe w makietach (nazwy plików, ścieżki walidacji, PESEL, czasy) są statyczne.

## Tokeny

Kolekcje: `Theme` (tryby Light, Dark), `Lang` (PL, EN), `Scale` (odstępy 4–40 px, promienie 6/10/16 px). Kolory: `background`, `surface`, `border`, `border-strong`, `text`, `muted`, `primary` (`#0052A5` w Light), `primary-foreground`, `success`, `warning`, `danger`, `info`. Typografia: Inter (tekst), Source Code Pro (kod). `border` jest dekoracyjny; obrysy pól używają `border-strong` (≥ 3:1).

## Widoki

| Widok | Telefon 390 | Tablet 820 | API |
|---|---|---|---|
| Logowanie | `Phone/Login` | `Tablet/Login` | nagłówek `Authorization: Bearer` |
| Upload | `Phone/Upload` | `Tablet/UploadQueue` | `POST /api/v1/forms/analyze` |
| Kolejka | `Phone/Queue` | `Tablet/UploadQueue` | `X-Processing-Time-Ms`, `X-Extractor` |
| Szczegóły pliku | `Phone/FileDetails` (arkusz) | panel boczny w `Tablet/UploadQueue` | jw. |
| Wynik JSON | `Phone/ResultJson` | `Tablet/ResultJson` | odpowiedź `analyze` |
| Walidacja | `Phone/ResultValidation` | `Tablet/ResultValidation` | `POST /api/v1/forms/validate` (`errors`, `warnings`) |
| Podgląd e-usługi | `Phone/ResultPreview` | `Tablet/ResultPreview` | `FormDefinition` |
| Stany dynamiczne | `Phone/PreviewDynamic` | `Tablet/PreviewDynamic` | `states[].query` (JSONata) |
| Otwórz JSON | `Phone/LoadJson` | `Tablet/LoadJson` | lokalnie, bez API |
| Ustawienia | `Phone/Settings` | `Tablet/Settings` | `GET /api/v1/formats`, `/ready` |

Każdy widok istnieje w czterech wariantach: Light·PL, Dark·PL, Light·EN, Dark·EN (sekcje na stronach „Ekrany telefon” i „Ekrany tablet”).

## Stany i błędy (strona „Stany i błędy”)

Pusta kolejka, ładowanie (szkielety), błędy pliku, 401 z zachowaniem kolejki, timeout, API niedostępne, brak uwag walidacji, duży JSON. Pole `ExternalSystem` i znacznik „błędny warunek” są w `PreviewDynamic`.

Kody i statusy pochodzą z `src/formgen/api/`. Wiersz błędu (`FileRow` w stanie Error) pokazuje `error.code`, status i komunikat; jedna ramka pokazuje wzorzec, pozostałe kody używają tego samego komponentu z innym tekstem.

Narysowane są ramki dla 413, 415 `UNSUPPORTED_MEDIA_TYPE`, 400 `INVALID_FILENAME`, 401 i 504. Pozostałe kody (`MIME_MISMATCH`, `MISSING_FILE`, `MODEL_UNAVAILABLE`, `INVALID_OUTPUT`, `AUTH_MISCONFIGURED`, 422) są opisane i używają tych samych komponentów (`FileRow` Error, `Toast` Error), bez osobnych ramek.

| Kod | HTTP | Wzorzec w makietach | Ponowienie |
|---|---|---|---|
| `FILE_TOO_LARGE` | 413 | `State/ErrorRows` | nie (zmień plik) |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `State/ErrorRows` | nie |
| `MIME_MISMATCH` | 415 | ten sam wiersz błędu, inny tekst | nie |
| `INVALID_FILENAME` (nazwa dłuższa niż 250 znaków lub znak ze zbioru `; : < > / \ \| ' * % $`) | 400 | `State/ErrorRows` | nie |
| `MISSING_FILE` (brak nazwy, brak pola `file`, pusty plik) | 400 | ten sam wiersz błędu | nie |
| `UNAUTHORIZED` (też w `/validate`) | 401 | `State/Unauthorized401` | po zalogowaniu |
| `PROCESSING_TIMEOUT` | 504 | `State/Timeout` | tak, tylko przy wyłączonym fallbacku (patrz niżej) |
| `MODEL_UNAVAILABLE` | 503 | wiersz błędu z przyciskiem „Ponów” | tak, tylko przy wyłączonym fallbacku |
| `INVALID_OUTPUT` | 500 | wiersz błędu | nie (heurystyka da ten sam wynik); komunikat dla użytkownika, bez „Ponów” |
| `AUTH_MISCONFIGURED` | 500 | toast błędu | nie |
| `INVALID_FORM_DEFINITION`, `INVALID_SAMPLE_VALUES` (`/validate`) | 422 | toast błędu; odpowiedź 200 z `errors` i `warnings` to `ResultValidation` | nie |

Odpowiedź błędu ma kopertę `{"error": {"code", "message", ...}}`. Walidacja ciała przez FastAPI (np. ciało niebędące obiektem JSON) może zwrócić `{"detail": [...]}` bez `error.code`, a nieoczekiwany wyjątek zwykłe 500 bez koperty. GUI musi pokazać wtedy ogólny błąd z samym statusem HTTP.

`/ready` zawsze zwraca 200 i konfigurację (`llm`, `ocr`), więc „API niedostępne” oznacza brak odpowiedzi z `/health`.

### Wynik zdegradowany (fallback heurystyczny)

Przy `llm_fallback_heuristic=True` (domyślnie) awaria lub timeout modelu nie kończy się błędem: `pipeline.run` przechodzi na heurystykę i `/analyze` zwraca 200 z `X-Extractor: HeuristicExtractor`. To najczęstszy skutek awarii modelu. GUI pokazuje wtedy wynik z komunikatem informacyjnym („Model niedostępny, użyto ekstraktora heurystycznego”); ramka `State/DegradedResult`. Kody 503 i 504 pojawiają się dopiero po wyłączeniu fallbacku.

## Komponenty

Button (4 style × 3 stany), IconButton (Menu, Close), TextField (Default, Focus, Error, ReadOnly, ExternalSystem), Select, Choice (checkbox, radio), Badge (5 statusów), Card, KeyValue, AppBar, BottomNav (złożony z NavItem), SideRail, Tab, StepIndicator, Dropzone, FileRow (Queued, Processing, Done, Error), JsonViewer, ValidationItem, BottomSheet i SidePanel (slot `content`), Toast, Skeleton, EmptyState, LangSwitch, ThemeSwitch, FieldBlock (Consent, TextBlock, Repeating). Etykiety instancji ustawia się przez właściwości tekstowe (`label`, `title`, `value`, `helper`, `message`, `error`, `file`).

## Decyzje

- Tablet: treść z `maxWidth` 640 obok SideRail; Upload, Kolejka i Szczegóły scalone w jeden ekran master-detail.
- Dostępność: cele dotykowe ≥ 44 px, kontrast AA sprawdzany testem dla obu motywów.
- Nawigacja: dolny pasek (telefon), szyna boczna (tablet). Ikon brak; aktywną pozycję oznacza pasek i pogrubienie.
- Prototyp: 37 połączeń na ekranach telefonu Light·PL (nawigacja, zakładki, logowanie, szczegóły, 401 do logowania).

## Zachowanie wymagane przez brief

- **Kolejka:** pliki idą do `/analyze` po kolei, jeden aktywny naraz; wiersze: W kolejce, Analiza (pasek), Gotowe, Błąd (`error.code` + komunikat). Szczegóły pliku pokazują ekstraktor (`X-Extractor`), czas (`X-Processing-Time-Ms`) i rozmiar; wykryty typ (`X-Detected-Type`) i liczba ostrzeżeń (`X-Warnings`) trzeba jeszcze dodać do szczegółów.
- **Limity:** Dropzone i Ustawienia pobierają dozwolone rozszerzenia i limit rozmiaru z `GET /api/v1/formats`; makiety pokazują wartości domyślne (25 MB, pdf, doc, docx, ods, xlsx, jpg, jpeg, png).
- **JSON:** kolorowanie składni, „Kopiuj” i „Pobierz JSON” w `ResultJson`, „Waliduj ponownie” w `ResultValidation`; długi JSON przewija się i zwija sekcje.
- **JWT:** pole tokenu w `Login`, token w `localStorage` (maskowany w Ustawieniach, „Usuń token”), przycisk „Kontynuuj bez logowania” dla `AUTH_ENABLED=false`. API nie ujawnia dziś tego ustawienia (`/ready` i `/formats` go nie zwracają), więc GUI nie wie, kiedy przycisk pokazać; do wdrożenia potrzebna jest flaga w API (np. `auth_enabled` w `/ready`), do tego czasu przycisk jest wyłącznie propozycją makiety.
- **Typy pól:** galeria `COI/FieldTypes` na stronie „Komponenty”: TEXT_FIELD, TEXTAREA, NUMBER, DATEPICKER, SELECT ze słownikiem (etykieta „Słownik: Kraje”), FILE_UPLOADER, CONSENT_SECTION, INFO_SECTION, REPEATING_SECTION („Dodaj kolejny”); RADIO i CHECKBOX to `Choice`.
- **Stany dynamiczne:** para `ResultPreview` (przed) i `PreviewDynamic` (po wybraniu „Inna osoba”: SHOW odsłania sekcję „Dane innej osoby”); READ_ONLY to pole `ReadOnly` / `ExternalSystem` (placeholder „MLPZ.name”); błąd JSONata to znacznik „błędny warunek”.
- **E-usługa:** karta sekcji, wskaźnik kroków, „Wstecz”, „Dalej”, „Przerwij wypełnianie”, gwiazdka przy polach wymaganych.

## Przegląd Codex (2026-11-21)

Codex przeczytał opis makiet, kod API i brief (nie oglądał ramek FigCraft). Zgłosił 14 uwag:

| # | Uwaga | Stan |
|---|---|---|
| 1 | błędny kod 415 | poprawione w makietach i opisie |
| 2 | granica nazwy 250 znaków | opis poprawiony; makieta pokazuje nazwę dłuższą niż 250 |
| 3 | brak części kodów błędów | tabela w opisie; wspólny wiersz błędu |
| 4 | błąd 422 w `/validate` | opis; toast błędu |
| 5 | interpretacja `/ready` | poprawione: „API niedostępne” = brak odpowiedzi `/health` |
| 6 | `/health`, `X-Detected-Type`, `X-Warnings` | do dodania w Ustawieniach i szczegółach pliku (odroczone) |
| 7 | limity z `/formats` | opisane |
| 8 | batch sekwencyjny | opisane |
| 9 | operacje na JSON | opisane |
| 10 | typy pól | galeria `COI/FieldTypes` |
| 11 | SHOW/READ_ONLY | opisane (para przed/po) |
| 12 | zachowania e-usługi | opisane; gwiazdka dodana |
| 13 | JWT | opisane |
| 14 | rozbieżność stosu | do decyzji zespołu, patrz niżej |

## Stan implementacji (aplikacja `apps/web`)

Decyzja o stosie zapadła: [ADR-002](../07-decyzje/ADR-002-gui-nextjs.md) (Next.js, React, TypeScript, TanStack). Zaimplementowane i przetestowane (324 testy jednostkowe, 28 e2e): logowanie, upload z kolejką i szczegółami pliku, wynik JSON, walidacja, podgląd e-usługi ze stanami dynamicznymi, otwórz JSON, ustawienia, stany błędów i pustki, katalog `/design-system`, motyw jasny/ciemny, PL/EN, telefon i tablet, mock API zgodny z kontraktem.

Nie zrobione (zadania z dokładnymi instrukcjami w [GUI-DO-ZROBIENIA.md](GUI-DO-ZROBIENIA.md)): źródło PDF, przegląd z edycją, uwagi i raport v2, wsad (Z1); dostępność axe (Z2); CSP i test braku żądań zewnętrznych (Z3); spis licencji (Z4); warunki w instancjach `REPEATING_SECTION` (Z5); `auth_enabled` i limit wsadu w API (Z6); Docker i e2e w CI (Z8); test z prawdziwym backendem (Z9); odbudowa makiet FigCraft i zapis pliku (Z10).
