---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: plan do akceptacji
---

# Makiety GUI w FigCraft — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plik FigCraft z fundamentem (tokeny), komponentami, userflow i ekranami GUI dla telefonu i tabletu, w motywie jasnym i ciemnym oraz po polsku i angielsku.

**Architecture:** Zmienne FigCraft jako jedyne źródło wartości: kolekcja `Theme` (tryby Light, Dark), kolekcja `Lang` (tryby PL, EN, zmienne tekstowe wiązane z `characters`), kolekcja `Scale` (odstępy, promienie). Komponenty z wariantami korzystają tylko ze zmiennych. Ekrany to ramki z ustawionym trybem. Tokeny eksportowane do Tailwind v4, testowane kontrastem WCAG.

**Tech Stack:** FigCraft (MCP `mcp__figcraft__*`), Python 3 + pytest (kontrola tokenów), Codex (przegląd).

**Spec:** `docs/superpowers/specs/2026-11-21-makiety-gui-design.md`

## Global Constraints

- Telefon 390 px, tablet 820 px. Desktop poza zakresem.
- Tryby motywu: `Light`, `Dark`. Tryby języka: `PL`, `EN`.
- Akcent `#0052a5` (Light, `color/primary`). Czcionka Inter.
- Kontrast WCAG AA: tekst 4.5:1, duży tekst i elementy UI 3:1, w obu motywach.
- Cele dotykowe min. 44 px.
- Nazwy tokenów: `color/background`, `color/surface`, `color/border`, `color/text`, `color/muted`, `color/primary`, `color/primary-foreground`, `color/success`, `color/warning`, `color/danger`, `color/info`.
- Pliki: `design/formularze-gui.figcraft`, `design/tokens.json` (eksport JSON), `design/tokens.css` (Tailwind v4).
- Nic nie jest przywiązane do CDN. Brak desktopu, kont, historii, panelu admina.
- Dokumentacja po polsku. Przed commitem `python3 scripts/verify_docs.py`.

## Review Focus

- Polskie teksty są ok. 20% dłuższe od angielskich: przyciski i zakładki nie mogą się przycinać na 390 px (test: ekran w trybie PL).
- Nazwa pliku do 250 znaków w wierszu kolejki: obcięcie ze środkiem lub zawinięcie, bez rozpychania układu.
- 401 w trakcie pracy: komunikat i powrót do logowania bez utraty kolejki.
- 413 i zły format: błąd na poziomie wiersza, reszta kolejki działa dalej.
- Odznaki statusu i walidacji w ciemnym motywie: kontrast ≥ 4.5:1.
- Pole `readOnly` z `EXTERNAL_SYSTEM` (placeholder „MLPZ.name”) i błędny warunek JSONata: osobne stany pola.
- Bardzo duży JSON: widok z przewijaniem i zwijaniem sekcji, nie pełna wysokość strony.

---

### Task 1: Fundament i tokeny

**Files:**
- Create: `design/formularze-gui.figcraft`, `design/tokens.json`, `design/tokens.css`
- Test: `tests/test_gui_tokens.py`

**Interfaces:**
- Produces: kolekcje `Theme`, `Lang`, `Scale`; style tekstu `Text/Display`, `Text/Title`, `Text/Body`, `Text/Caption`, `Text/Mono`; strony pliku: `Fundament`, `Komponenty`, `Userflow`, `Ekrany telefon`, `Ekrany tablet`, `Stany i błędy`.

- [ ] **Step 1: Write the failing test** w `tests/test_gui_tokens.py`: `test_tokens_have_both_modes` (każdy z 11 tokenów kolorów ma wartość w `Light` i `Dark`), `test_contrast_aa` (text/background, text/surface, muted/surface, primary-foreground/primary, każdy status na surface: ≥ 4.5 w obu trybach; border/surface ≥ 3), `test_primary_light_is_brief_accent` (`color/primary` Light == `#0052A5`). Wczytuje `design/tokens.json`.
- [ ] **Step 2: Run** `pytest tests/test_gui_tokens.py -v`. Expected: FAIL (brak pliku).
- [ ] **Step 3: Create the file** (`file.new` lub `open_file`), strony jak wyżej; `variable.createCollection` dla `Theme` (Light, Dark), `Lang` (PL, EN), `Scale`; zmienne kolorów wg Global Constraints (wartości startowe Light: background `#F4F6F9`, surface `#FFFFFF`, border `#D5DBE3`, text `#141A24`, muted `#4A5565`, primary `#0052A5`, success `#1B7F4B`, warning `#8A5A00`, danger `#B3261E`, info `#0B6BCB`; Dark: background `#0E131B`, surface `#161D28`, border `#2B3647`, text `#E8EDF4`, muted `#A3AFC0`, primary `#6AA6F0`, success `#4CC38A`, warning `#E5B13A`, danger `#FF8A80`, info `#7DB6F5`; foreground na primary dobierz, by spełnić test). Zmienne `Scale`: `space/1..8`, `radius/sm|md|lg`. Style tekstu w Inter. Eksport: `variable.export` format `json` do `design/tokens.json`, format `tailwind` do `design/tokens.css`. Zapis: `save_file`.
- [ ] **Step 4: Run** `pytest tests/test_gui_tokens.py -v`. Expected: PASS. Popraw wartości, jeśli kontrast nie przechodzi.
- [ ] **Step 5: Commit** `design/`, `tests/test_gui_tokens.py`.

### Task 2: Komponenty

**Files:** Modify: `design/formularze-gui.figcraft` (strona `Komponenty`).

**Interfaces:**
- Consumes: zmienne z Task 1 (powiązane przez `variable.bind`, bez surowych kolorów).
- Produces: komponenty (nazwa: wariantowe właściwości): `Button` (Primary, Secondary, Ghost, Danger × Default, Disabled, Loading), `IconButton`, `TextField` (Default, Focus, Error, ReadOnly, ExternalSystem), `Select`, `Checkbox`, `Radio`, `Badge` (Success, Warning, Danger, Info, Neutral), `Card`, `AppBar`, `BottomNav`, `SideRail`, `Tabs`, `StepIndicator`, `Dropzone` (Idle, DragOver, Disabled), `FileRow` (Queued, Processing, Done, Error), `JsonViewer`, `ValidationItem` (Error, Warning), `BottomSheet`, `SidePanel`, `Toast`, `Skeleton`, `EmptyState`, `LangSwitch`, `ThemeSwitch`, `FieldBlock` (wzorzec pola COI: TEXT_FIELD, TEXTAREA, NUMBER, DATEPICKER, RADIO, CHECKBOX, SELECT, FILE_UPLOADER, CONSENT, TEXT_BLOCK, REPEATING_SECTION). Etykiety to zmienne `Lang`.

- [ ] **Step 1:** Zbuduj atomy (`Button`, `TextField`, `Badge`, `Checkbox`, `Radio`) z auto layoutem i wariantami (`component.combineVariants`); sprawdź `inspect_document`: brak wypełnień bez `boundVariables`.
- [ ] **Step 2:** Zbuduj złożone (`FileRow`, `FieldBlock`, `JsonViewer`, `ValidationItem`, nawigacje, panele) z instancji atomów.
- [ ] **Step 3: Verify** `screenshot` strony `Komponenty` w trybie Light i Dark (`variable.setMode`); sprawdź, że przełączenie zmienia wszystkie komponenty, a w trybie PL żaden `Button` nie przycina tekstu.
- [ ] **Step 4: Commit** (`save_file`, `git add design/`).

### Task 3: Userflow

**Files:** Modify: `design/formularze-gui.figcraft` (strona `Userflow`).

- [ ] **Step 1:** Narysuj diagram z rozmowy: Start → Logowanie → Upload i kolejka → walidacja kliencka → analyze → Szczegóły pliku → JSON / Walidacja / Podgląd → Stany dynamiczne; ścieżki: Wczytaj JSON, Ustawienia, wskaźnik stanu systemu, 401 → Logowanie. Węzły z kolorem wg typu (ekran, decyzja, błąd), podpisane PL i EN.
- [ ] **Step 2: Verify** `screenshot`; każdy z 9 widoków i stanów błędów ze specu występuje w diagramie dokładnie raz.
- [ ] **Step 3: Commit.**

### Task 4: Ekrany telefon (390)

**Files:** Modify: `design/formularze-gui.figcraft` (strona `Ekrany telefon`).

**Interfaces:** Consumes komponenty z Task 2. Produces ramki o nazwach `Phone/<Widok>`, ustawione tryby `Theme`/`Lang` per ramka; każdy widok istnieje w 4 kombinacjach (Light/Dark × PL/EN) jako osobne ramki z tym samym drzewem.

- [ ] **Step 1:** Widoki: `Login`, `Upload`, `Queue`, `FileDetails` (bottom sheet), `ResultJson`, `ResultValidation`, `ResultPreview`, `PreviewDynamic`, `LoadJson`, `Settings`. Wskaźnik stanu systemu w AppBar z rozwijanymi szczegółami. Dolna nawigacja: Upload, Wynik, Wczytaj, Ustawienia.
- [ ] **Step 2:** Zbuduj wersję Light/PL, zduplikuj (`edit.duplicate`) i przestaw tryby przez `variable.setMode`.
- [ ] **Step 3: Verify** `screenshot` każdej ramki; w PL brak przycięć, obszary dotykowe ≥ 44 px (`get_node` rozmiary), `inspect_document`: brak surowych kolorów.
- [ ] **Step 4: Commit.**

### Task 5: Ekrany tablet (820)

**Files:** Modify: strona `Ekrany tablet`.

- [ ] **Step 1:** Te same widoki z `SideRail` i układem dwukolumnowym (kolejka po lewej, wynik po prawej, `SidePanel` zamiast bottom sheet). Nazwy `Tablet/<Widok>`, 4 kombinacje motyw × język.
- [ ] **Step 2: Verify** `screenshot`; ta sama lista widoków co w Task 4 (porównaj `node.find` po nazwach).
- [ ] **Step 3: Commit.**

### Task 6: Stany i błędy

**Files:** Modify: strona `Stany i błędy`.

- [ ] **Step 1:** Ramki telefon i tablet: pusta kolejka, szkielet ładowania, wiersz `error` (zły format, 413, nazwa 250+ znaków), 401 (powrót do logowania), timeout, API niegotowe (`/ready`), błędny warunek JSONata, pole `ExternalSystem`, pusty wynik walidacji, bardzo duży JSON.
- [ ] **Step 2: Verify** `screenshot`; każda linia z Review Focus ma ramkę (sprawdź po nazwach `State/*`).
- [ ] **Step 3: Commit.**

### Task 7: Prototyp i eksport

**Files:** Modify: plik FigCraft; regenerate: `design/tokens.json`, `design/tokens.css`.

- [ ] **Step 1:** Połącz ramki `Phone/*` interakcjami (`proto.interaction.add`, `navigate`) zgodnie z userflow; ścieżka 401 prowadzi do `Phone/Login`.
- [ ] **Step 2:** Ponów eksport zmiennych (JSON, Tailwind), `save_file`.
- [ ] **Step 3: Verify** `pytest tests/test_gui_tokens.py -v` PASS; `python3 scripts/verify_docs.py` OK.
- [ ] **Step 4: Commit.**

### Task 8: Przegląd Codex i zamknięcie

**Files:** Create: `docs/08-implementacja/GUI-MAKIETY.md` (opis pliku, mapa widoków, lista decyzji, wynik przeglądu); Modify: `CHANGELOG.md`, `docs/README.md` (link).

- [ ] **Step 1:** Wyeksportuj `screenshot` ekranów do katalogu roboczego i uruchom Codex jako pracownika Orca (skill `orchestration`) z zadaniem: porównaj makiety z `src/formgen/api/app.py`, `docs/08-implementacja/FRONTEND-BRIEF.md` i kodami błędów; zwróć listę rozbieżności z priorytetem.
- [ ] **Step 2:** Popraw wszystkie rozbieżności o wysokim priorytecie, pozostałe zapisz w `GUI-MAKIETY.md`.
- [ ] **Step 3: Verify** `pytest -q` i `python3 scripts/verify_docs.py` przechodzą.
- [ ] **Step 4: Commit** z wpisem w `CHANGELOG.md`.
