---
wersja: 0.5.0
aktualizacja: 2026-11-22
status: implementacja
---

# Interfejs przeglądu `/review/`

Interfejs odpowiada na pkt 3.3 IV (frontend do importu plików i podglądu JSON) i pkt 3.3 V (wizualizacja e-usługi) zadania. Jest dostępny pod `http://127.0.0.1:8000/review/`, na tym samym serwerze co API. Nie zmienia kontraktu API ani ekstrakcji.

Cel: urzędnik porównuje blankiet z wygenerowaną konfiguracją, sprawdza zachowanie e-usługi i zapisuje uwagi przed przekazaniem JSON do COI.

## 1. Uruchomienie

Lokalnie, po `make venv`:

```sh
npm ci
npm run ui:assets
make run
```

`npm ci` potrzebuje sieci tylko przy instalacji. `ui:assets` kopiuje przypięte PDF.js i JSONata oraz ich licencje do `src/formgen/static/review/vendor/` (katalog poza Git). Podczas pracy UI nie korzysta z CDN, zdalnych fontów ani rejestrów.

Docker: `Dockerfile` buduje te same zasoby w etapie `node:22.23.1-alpine3.24` i kopiuje je do obrazu. Obraz końcowy nie zawiera Node ani `node_modules`. `pyproject.toml` pakuje UI jako `package-data`.

Do podglądu wystarcza serwer API, model może być wyłączony. Przykładowe pliki (po `python3 scripts/sync_materials.py`):

- PDF: `data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF`
- JSON: `data/input/02_przyklady_json/05_nadplata_podatku.json`

`make run` wyłącza autoryzację tylko dla lokalnej demonstracji. Z autoryzacją uruchom `.venv/bin/python -m formgen` i wpisz token Bearer w sekcji „Uwierzytelnianie API” (`python scripts/make_token.py`). UI nie zapisuje tokena w plikach ani w localStorage.

Rzeczywiste AI: uruchom `make llm` albo wskaż serwer przez `LLM_BASE_URL`, z `EXTRACTOR=llm`. Przycisk „Prześlij PDF do API” wysyła jeden plik jako multipart `file` do `/api/v1/forms/analyze`. Etykieta pochodzenia wyniku opiera się na nagłówku `X-Extractor`: `LlmExtractor` = AI, `HeuristicExtractor` = tryb zastępczy, `StubExtractor` = tryb testowy, brak lub inny nagłówek = nieznane pochodzenie. Niepowodzenie zachowuje poprzednią konfigurację.

Wsad: pole „Wiele plików do API” przyjmuje do 20 plików naraz (upuszczenie albo wybór z dysku) w dowolnym formacie API. UI wysyła je jednym żądaniem multipart `files` do `/api/v1/forms/analyze-batch`. Lista „Pliki wsadu” po lewej pokazuje każdy plik ze statusem: „Gotowy” z ekstraktorem albo kod i komunikat błędu tego pliku. Kliknięcie gotowego pliku wczytuje jego konfigurację, a dla PDF także podgląd źródła. Błąd jednego pliku nie zatrzymuje pozostałych.

## 2. Scenariusz demonstracji

1. Wczytaj PDF i JSON formularza 05. PDF jest po lewej, 73 elementy czterech stron po prawej. „Przegląd wszystkich pól” nie ukrywa pól zależnych od odpowiedzi.
2. Przejdź do symulacji. Wybierz „Innej osoby”, „Swoim”, ponownie „Innej osoby”. Sekcja danych innej osoby i pełnomocnictwa pojawia się i znika. Dla osoby prawnej porównaj wariant pełnomocnika i reprezentanta. Na stronie rozliczenia przełącz rachunek bankowy, zaliczenie na przyszły podatek i znowu rachunek.
3. Wróć do przeglądu. Dodaj uwagę do pola „Kwota”, potem „Zgłoś brakującą informację” z miejscem w PDF i opisem. Raport uwag jest odrębny od konfiguracji.
4. Pobierz czysty JSON i raport uwag. Raport zawiera SHA-256 kanonicznego JSON (klucze obiektów posortowane, kolejność tablic zachowana), pochodzenie i uwagi. Eksport COI nie zawiera odpowiedzi symulacji ani uwag.
5. Wczytaj inną konfigurację: lista uwag jest pusta, skrót się zmienia. Pobierz raport przed zmianą wyniku lub odświeżeniem karty, bo UI nie archiwizuje danych.
6. Wczytaj `tests/ui/fixtures/cross-page.json` (przykład kontrolny, nie wynik AI). Na stronie Pierwsza wybieraj Tak, Nie, Tak. Na stronie Druga pole zależne pokazuje się, znika i znowu się pokazuje; drugie pole blokuje się i odblokowuje tak samo.
7. Wyślij PDF 05 do API. Obserwuj przetwarzanie, pochodzenie, czas i wynik lub błąd. Uruchom „Waliduj strukturę przez API”. Zielony wynik techniczny nie potwierdza treści.
8. Upuść na pole „Wiele plików do API” kilka plików z `data/input/04_formularze_do_oceny/` w różnych formatach oraz plik `.txt`. Lista pokazuje gotowe pliki i błąd 415 dla `.txt`. Przełączaj formularze kliknięciem na liście.

## 3. Sprawdzenia

```sh
npm run check:ui   # zasoby zgodne z package-lock, składnia JS, Prettier
npm run test:ui    # 14 testów Playwright
make test
make lint
```

Testy UI używają lokalnego Google Chrome (Playwright `channel: chrome`), osobnego API na porcie 8015 (`PYTHONPATH=src`, czyli kod z bieżącego katalogu) i testowego JWT. Test API sprawdza prawdziwe 401, JWT, heurystyczny fallback przy niedostępnym modelu i walidację. Testy z podstawionymi odpowiedziami HTTP sprawdzają tylko etykiety kontraktu. Nie są dowodem jakości AI.

## 4. Ograniczenia

- Podgląd źródła obsługuje tylko PDF. Przycisk „Prześlij PDF do API” wysyła tylko PDF. Pozostałe formaty (DOC, DOCX, ODS, XLSX, JPG, PNG) przechodzą przez wsad, bez podglądu źródła.
- Wybór innego pliku z listy wsadu działa jak wczytanie nowej konfiguracji: uwagi poprzedniego wyniku znikają. Pobierz raport przed przełączeniem.
- Renderowane są wszystkie typy elementów z referencji 05. Nieobsługiwany typ (np. sekcja powtarzalna) jest oznaczony jako problem razem z dziećmi.
- Nie ma pełnego edytora konfiguracji.
- Pola rejestrowe są puste i opisane. Słowniki przyjmują wartości wpisane ręcznie jako dane przykładowe. Załączniki symulacji nie są nigdzie wysyłane.
- Podgląd PDF rysuje płótno i tekst bez wykonywania skryptów PDF i aktywnych adnotacji. Teksty HTML z konfiguracji są wyświetlane jako tekst. Warunki liczy izolowany worker z limitem 2 sekund.
- Symulacja nie zastępuje walidacji w Generatorze COI: wymagalność, rejestry, podpis i wysyłka nie są sprawdzane.

## 5. Pochodzenie

Interfejs powstał i przeszedł odbiór formularza 05 w osobnej kopii roboczej (nagrana demonstracja z lokalnym Qwen3.5-4B, 57 obserwacji PASS). Te dowody nie są częścią tego repozytorium. W tym repozytorium dowodem są testy z sekcji 3, uruchomione na kodzie `develop`.
