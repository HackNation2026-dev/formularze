---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Frontend – brief dla zespołu (rozszerzenia IV i V zadania)

Cel: jedna statyczna strona serwowana przez FastAPI pod `GET /` (bez build stepu, bez CDN w runtime – aplikacja działa offline).
Pliki: `src/formgen/static/index.html`, `app.js`, `style.css`, `vendor/jsonata.min.js` (już jest, MIT, oficjalny build JSONata 2.x).
Montaż: w `src/formgen/api/app.py` dodać `app.mount("/static", StaticFiles(...))` i `GET /` -> `FileResponse(index.html)`. Testy (`make test`) muszą zostać zielone.

## Wzorzec wyglądu
Screeny eUsługi: `data/input/03_screeny_euslugi/wniosek_nadplata_podatku/image1.png`, `image13.png`. Białe karty na szarym tle, niebieski `#0052a5`, Inter/system font, jedna kolumna, przyciski „Wstecz” / „Dalej”, link „Przerwij wypełnianie”.

## Funkcje
1. **Upload** (IV): drag&drop lub picker, wiele plików (batch). Pole na JWT (localStorage) -> nagłówek `Authorization: Bearer`. Dla każdego pliku `POST /api/v1/forms/analyze` sekwencyjnie; wiersz ze statusem (queued / processing / done / error z `error.code` + `error.message`), czas z nagłówka `X-Processing-Time-Ms`, przyciski: „Podgląd JSON”, „Wizualizacja”, „Pobierz JSON”.
2. **JSON**: pretty-print z prostym kolorowaniem (bez bibliotek), „Kopiuj”, „Waliduj” -> `POST /api/v1/forms/validate` i lista `errors` / `warnings`.
3. **Wizualizacja** (V): render `FormDefinition` jak eUsługa. Karta per `SECTION` (tytuł bold, `description` to HTML – renderować przez innerHTML po usunięciu `<script>`). Pola: `TEXT_FIELD` input, `TEXTAREA`, `NUMBER` type=number, `DATEPICKER` type=date, `RADIO` grupa radio z `options[].name`, `CHECKBOX` grupa checkbox, `SELECT` select z opcji lub, gdy `dictionaryName`, select z etykietą „Słownik: <nazwa>” i przykładowymi wartościami (Kraje: Polska, Niemcy, Czechy), `FILE_UPLOADER` kreskowany box „Dodaj lub przeciągnij plik”, `CONSENT_SECTION` checkboxy z `consentSectionConfig.consents[].description` (HTML), `TEXT_BLOCK` / `INFO_SECTION` blok HTML, `REPEATING_SECTION` z przyciskiem „Dodaj kolejny”. `readOnly` = szary disabled input z `defaultValue` (dla `EXTERNAL_SYSTEM` placeholder np. „MLPZ.name”). Walidatory jako małe szare odznaki (`REQUIRED` = gwiazdka przy etykiecie). Taby jako wskaźnik kroków u góry, nawigacja po `flow.links`.
4. **Stany dynamiczne**: każdy `states[].query` liczyć jsonata na żywo na obiekcie stanu w kształcie, jakiego oczekują zapytania:
   `{ tabs: [ { title, questions: [ { field: { techName, repeatingSectionGrid: [ { field: { techName, __userAnswer } } ], __userAnswer } } ] } ] }`
   `__userAnswer`: string dla text/radio/select, tablica stringów dla checkbox, dla SELECT z `defaultValue` wartość początkowa = `defaultValue`. Przeliczać przy każdej zmianie. `SHOW=false` ukrywa, `READ_ONLY` wyłącza. Błąd jsonata -> czerwona odznaka „błędny warunek” przy polu, bez crasha.
   Test akceptacyjny na `data/input/02_przyklady_json/05_nadplata_podatku.json`: „Innej osoby” odsłania „Dane innej osoby” i „Pełnomocnictwo”; „Osoby prawnej...” odsłania „Wybierz, jako kto wnioskujesz”, „Dane podmiotu”, „Adres siedziby”; „Pełnomocnik” odsłania „Opłata skarbowa za pełnomocnictwo”; strona 2: radio odsłania „Nazwa podatku” / „Numer rachunku”; Kraj inny niż Polska chowa TERYT i pokazuje pola zagraniczne.
5. **Wczytaj JSON** z dysku prosto do wizualizacji (bez API), żeby jury mogło podejrzeć dowolny plik.

Uruchomienie do dev: `AUTH_ENABLED=false EXTRACTOR=stub make run` -> http://localhost:8000 (stub daje szablonowe strony bez LLM).
