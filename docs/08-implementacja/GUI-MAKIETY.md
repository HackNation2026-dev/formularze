---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: makiety gotowe w sesji FigCraft; plik .figcraft poza repo
---

# Makiety GUI (FigCraft)

Projekt: [specyfikacja](../superpowers/specs/2026-11-21-makiety-gui-design.md), plan: [plan wdrożenia](../superpowers/plans/2026-11-21-makiety-gui.md). Tokeny: `design/tokens.css` (Tailwind v4) i `design/tokens.json`. Test kontrastu: `tests/test_gui_tokens.py`.

## Stan i ograniczenia

- Makiety istnieją w sesji FigCraft `formularze-gui` (6 stron). Silnik FigCraft działa w sandboxie bez dostępu do systemu plików repo, więc pliku `design/formularze-gui.figcraft` nie ma w Git. Sesję można otworzyć lokalnie (`collab.host`) i zapisać z aplikacji FigCraft.
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
| `INVALID_FILENAME` (nazwa dłuższa niż 250 znaków lub znaki `;:<>/\|'*%$`) | 400 | `State/ErrorRows` | nie |
| `MISSING_FILE` (brak pola, pusty plik) | 400 | ten sam wiersz błędu | nie |
| `UNAUTHORIZED` | 401 | `State/Unauthorized401` | po zalogowaniu |
| `PROCESSING_TIMEOUT` | 504 | `State/Timeout` | tak |
| `MODEL_UNAVAILABLE` | 503 | wiersz błędu z przyciskiem „Ponów” | tak |
| `INVALID_OUTPUT` | 500 | wiersz błędu | tak |
| `AUTH_MISCONFIGURED` | 500 | toast błędu | nie |
| `INVALID_FORM_DEFINITION`, `INVALID_SAMPLE_VALUES` (`/validate`) | 422 | toast błędu; odpowiedź 200 z `errors` i `warnings` to `ResultValidation` | nie |

`/ready` zawsze zwraca 200 i konfigurację (`llm`, `ocr`), więc „API niedostępne” oznacza brak odpowiedzi z `/health`, a niedostępny model to `MODEL_UNAVAILABLE` z `/analyze`.

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
- **JWT:** pole tokenu w `Login`, token w `localStorage` (maskowany w Ustawieniach, „Usuń token”), przycisk „Kontynuuj bez logowania” dla `AUTH_ENABLED=false`.
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

## Otwarta decyzja: stos GUI

`FRONTEND-BRIEF.md` zakłada statyczny HTML/JS/CSS bez build stepu serwowany przez FastAPI. Specyfikacja makiet i `docs/04-architektura/pelna-aplikacja.md` zakładają aplikację React/TypeScript (Next.js, TanStack). Makiety i tokeny nie zależą od wyboru; zmiana stosu wymaga osobnej decyzji z konsekwencjami (zob. `AGENTS.md`).
