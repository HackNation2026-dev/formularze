---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Analiza materiałów z Discorda (COI, 2026-11-21)

Źródło: `data/input/_discord_raw/Materiały do zadania dla Uczestników.zip` (8 plików). Teksty wyciągnięte do `docs/materialy/`.

## Co dostaliśmy
| Plik | Co to | Gdzie |
|---|---|---|
| `importowanyPlikJsonSchemat.json` | JSON Schema docelowego pliku (`FormDefinition`) | `data/input/02_przyklady_json/`, `docs/materialy/` |
| `OpisImportowanegoPlikuJSON.docx` | opis każdego pola schematu | `docs/materialy/opis_importowanego_json.md` |
| `Reguły techniczne konfiguracji...docx` | **obligatoryjne** reguły: typy komponentów, walidatory, stany dynamiczne, jsonata | `docs/materialy/reguly_techniczne_konfiguracji.md` |
| `Standardy i dobre praktyki projektowania formularzy.pdf` | ~30 stron: ton, układ, sekcje predefiniowane (Urząd, Podmiot wniosku, Twoje dane, Adres, Pełnomocnictwo, Opłata skarbowa, Dane do kontaktu, Zgody, Podsumowanie) | `docs/materialy/standardy_projektowania_formularzy.txt` + obrazy `data/input/05_.../standardy_obrazy/` |
| `Słowniki.docx` | 6 słowników: Województwo, Powiat, Gmina, Miejscowość, Kraje, Numery kierunkowe | `docs/materialy/slowniki.md` |
| `Dane inicjalne.pdf` | źródła danych: PESEL, PESEL_ADDRESS, MLPZ + atrybuty | `docs/materialy/dane_inicjalne.txt` |
| 2x `wizualizacja...docx` | opis stron + 16 screenów eUsługi dla 2 wniosków (nadpłata podatku, numer porządkowy nieruchomości) | `data/input/03_screeny_euslugi/<nazwa>/image*.png` |

## CZEGO BRAKUJE (wg pkt 3.1 zadania)
- **3.1.I** przykładowe formularze źródłowe (PDF/DOC/XLSX/skany) + **odpowiadające im gotowe JSON-y** – jest tylko SCHEMA, brak instancji. Mamy screeny 2 formularzy, ale nie ich plików źródłowych ani JSON-ów.
- **3.1.II** formularze do oceny (dla których generujemy JSON do zgłoszenia) – brak.
- Pytać na Discordzie / stoisku COI. Bez 3.1.II nie ma czego oddać.

## Schemat docelowy – esencja
```
FormDefinition { title, tabs[], flow{links[]} }
tab { id(UUID), title, type: MAIN|FINISH, questions[] }
question { x, y, rows, cols, field }          # grid: CSS grid-area: y+1 / x+1 / span rows / span cols
field { id(UUID), type, techName, title, description, options[{id,name,techName}],
        validation[string], dictionaryName, readOnly, repetingSectionGrid[question],
        defaultValue, defaultValueType: ""|EXTERNAL_SYSTEM, consentSectionConfig{consents[{description,required}],required,files[]},
        states[{type: SHOW|READ_ONLY, query: <jsonata>}], questionOrder, tooltipMessage }
link { id(UUID), source: tabId, target: tabId }
```
Uwaga: literówka w schemacie `repetingSectionGrid` (w regułach/jsonata: `repeatingSectionGrid`). Trzymać się schematu JSON (`repetingSectionGrid`) – potwierdzić z mentorem.

Typy komponentów: `SECTION`, `REPEATING_SECTION`, `TEXT_FIELD`, `TEXTAREA`, `NUMBER`, `CHECKBOX`, `RADIO`, `SELECT`, `DATEPICKER`, `FILE_UPLOADER`, `CONSENT_SECTION`, `TEXT_BLOCK`, `INFO_SECTION`.
Dodatkowe atrybuty poza schematem (z reguł): `searchEnabled` (SELECT), `selectAllEnabled` (CONSENT_SECTION).

Walidatory: `REQUIRED`, `EMAIL`, `PESEL`, `NIP`, `REGON`, `ZIP_CODE`, `EPUAP`, `ADE`, `SERIAL_NUMBER_ID_CARD` (+ w standardach: Pattern/regex dla KRS – nie ma go na liście walidatorów, pytanie).

## Twarde reguły strukturalne (walidator wyjścia = pydantic)
1. `title` <= 255 znaków.
2. >= 2 taby; ostatni `FINISH`, reszta `MAIN`.
3. Każdy tab >= 1 question.
4. Każde pole zagnieżdżone w `SECTION` lub `REPEATING_SECTION` (przez `repetingSectionGrid`). Brak sekcji w sekcji.
5. Tab FINISH: tylko `INFO_SECTION`.
6. Każde pole ma określoną obligatoryjność (`REQUIRED` w `validation` lub brak).
7. Taby połączone `flow.links` (MAIN1 -> MAIN2 -> ... -> FINISH).
8. Zależności widoczności = `states[{SHOW, jsonata}]`.
9. Słownik tylko w SELECT/RADIO/CHECKBOX; słowniki adresowe + Kraje tylko w SELECT.
10. Dane inicjalne: `readOnly: true`, `defaultValue: "MLPZ.name"`, `defaultValueType: "EXTERNAL_SYSTEM"`.

Wzór jsonata SHOW:
```
("Polska" in tabs['Dane' in title].questions['adres_zamieszkania' in field.techName].field.repeatingSectionGrid['kraj' in field.techName].field.__userAnswer)
```

## Standard układu formularza (z dobrych praktyk) – szablon generatora
Strona 1 (MAIN): Urząd (readOnly nazwa) -> Podmiot wniosku (radio Swoim/Innej osoby/Osoby prawnej; radio Pełnomocnik/Reprezentant warunkowo) -> Twoje dane (MLPZ readOnly: imię, nazwisko, PESEL) -> Adres (Kraj SELECT słownik Kraje default Polska; PL: woj/powiat/gmina/miejscowość SELECT słowniki, kod ZIP_CODE, ulica, nr budynku, nr lokalu; zagranica: miejscowość, kod, ulica...) -> [Dane innej osoby] -> [Dane podmiotu: Nazwa, NIP, REGON, KRS] -> [Pełnomocnictwo FILE_UPLOADER] -> [Opłata skarbowa radio Tak/Nie + TEXT_BLOCK + FILE_UPLOADER]
Strony 2..n (MAIN): przedmiot wniosku – sekcje tematyczne z papierowego formularza.
Przedostatnia (MAIN): Dane do kontaktu (telefon, email EMAIL, MLPZ) + Zgody (CONSENT_SECTION).
Ostatnia (FINISH): INFO_SECTION Podsumowanie + Podgląd.

Wniosek: duża część wyjściowego JSON-a jest **szablonowa i deterministyczna** (sekcje predefiniowane). AI potrzebne głównie do: (a) tytułu, (b) ustalenia kto może wnioskować (osoba/firma/oba), (c) ekstrakcji pól "przedmiotu wniosku" ze stron 2..n, (d) typów/walidacji/opcji, (e) zależności. To obniża koszt i podnosi wiarygodność – argument na "potencjał wdrożeniowy".

---

## Aktualizacja 2026-11-21 ~13:50 – druga paczka (9 zipów) – KOMPLET MATERIAŁÓW

Braki z poprzedniej sekcji są zamknięte. Zipy w `data/input/_discord_raw/zips/`, rozpakowane:

### 3.1.I Referencyjne (formularz źródłowy + gotowy JSON + screeny)
| Katalog | Formaty źródła | JSON wzorcowy |
|---|---|---|
| `01_przyklady_formularze/01_numer_porzadkowy_nieruchomosci/` | pdf(2 str), doc, docx, ods, xlsx, jpg, jpeg, png | `02_przyklady_json/01_numer_porzadkowy_nieruchomosci.json` |
| `01_przyklady_formularze/05_nadplata_podatku/` | PDF(1 str), DOC, docx, ODS, JPG, jpeg, PNG | `02_przyklady_json/05_nadplata_podatku.json` |

Ten sam formularz w każdym formacie = idealny zestaw do testów regresyjnych parsera (wynik ma być zbieżny niezależnie od formatu).

### 3.1.II Do oceny (generujemy JSON) – `04_formularze_do_oceny/`
| Katalog | Strony PDF | Uwagi |
|---|---|---|
| `02_zwrot_oplaty_skarbowej` | 2 | prosty |
| `03_wydanie_zaswiadczenia` | 1 | prosty |
| `04_wynajecie_swietlicy` | 1 | prosty |
| `06_zajecie_pasa_drogowego` | 2 | średni |
| `07_psy_rasy_agresywne` | 2 | średni; formaty pisane wielkimi literami: `.DOC .JPE .JPG .ODS .PDF .PNG` (brak docx/xlsx!) – obsłużyć `.JPE` i case-insensitive rozszerzenia |
| `08_deklaracja_odpady` | 6 | duży, układ tabelaryczny (sekcje A, B.1, B.2 ..., pola numerowane 1..N, kratki checkbox, daty DD-MM-RRRR) |
| `09_stypendium_sportowe` | 16 | bardzo duży, 3 wnioski w 1 (stypendium/nagroda/wyróżnienie) = strony alternatywne, listy dyscyplin = kandydat na nowy słownik |

Wszystkie PDF-y mają warstwę tekstową (brak AcroForm). PNG = render strony 1654 px szerokości, wysokość = n×2339 (A4 @ 200 dpi, strony sklejone pionowo – 09 ma 37424 px!). JPG analogicznie. OCR musi ciąć długie obrazy na strony.

### Wnioski z referencyjnych JSON-ów (`docs/materialy/referencyjne_json_outline.md`)
- Klucz to **`repeatingSectionGrid`** (schema ma literówkę `repetingSectionGrid` – ignorować schemę, trzymać się instancji).
- `validation` jest **puste wszędzie** w obu referencjach (nawet PESEL, email). Walidatory = nasz bonus, nie wymóg zgodności.
- Pola poza schematem, obecne w instancjach: `searchEnabled` (SELECT), `multiLevelTree` (SELECT TERYT), `minItemRows` (na question).
- Słowniki użyte w praktyce: `Kraje`, `TERYT_DOWODOWY`, `TERYT_4G_DOWODOWY` (adres PL jako jeden SELECT multiLevelTree, title = nazwa słownika!). Doc ze słownikami mówi o Województwo/Powiat/Gmina/Miejscowość – w instancjach zastąpione jednym TERYT. Używać nazw z instancji.
- `description` = HTML (`<html><head></head><body>...</body></html>`), pusty opis = `<html><head></head><body></body></html>` na sekcjach, `""` na polach.
- `options[].id` == `name` (np. `"id": "Swoim"`), `techName` = slug; jsonata porównuje po `name`.
- Grid: wszystko `x=0, cols=3`, sekcje `rows = liczba pól + 1`, `y` = skumulowane rows poprzednich; pola w sekcji `y = index`, `rows=1`. `questionOrder` == `y`.
- jsonata wzorce: `("Val" in tabs['Tab' in title].questions['sekcja' in field.techName].field.repeatingSectionGrid['pole' in field.techName].field.__userAnswer)`, negacja `$not(...)`, łączenie `and` / `or` z nawiasami.
- Dane inicjalne: 01 używa `MLPZ.*`, 05 używa `PESEL.*` – oba OK.
- Każdy formularz: tab1 "Dane" (szablon: urząd/organ, podmiot wniosku, twoje dane, adres, dane podmiotu, adres siedziby, potwierdzenie reprezentanta, dane innej osoby, adres innej osoby, pełnomocnictwo, opłata skarbowa ×2), tab2..n tematyczne, przedostatni "Kontakt..." (dane do kontaktu + zgoda), FINISH "Strona końcowa" (sekcja + TEXT_BLOCK podgląd).
- Z papierowego formularza do JSON-a trafia tylko "przedmiot wniosku" (05: rodzaj podatku, kwota, uzasadnienie, rozliczenie nadpłaty radio + warunkowe pola, korekta deklaracji FILE_UPLOADER). Pola papierowe typu "Nazwisko i imię / adres / PESEL / NIP / podpis / data / miejscowość" są **zastąpione** sekcjami szablonowymi, nie kopiowane 1:1.

### Plan testów
1. Golden: 01 i 05 – nasz output vs JSON referencyjny (metryka: pokrycie techName/title/type per tab + poprawność stanów).
2. Cross-format: ten sam formularz w 7 formatach -> ten sam JSON (tolerancja na OCR).
3. 7 formularzy do oceny -> `data/output/` + ręczny przegląd w wizualizatorze.
