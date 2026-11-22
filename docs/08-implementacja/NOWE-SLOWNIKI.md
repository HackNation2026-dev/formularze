---
wersja: 0.4.0
aktualizacja: 2026-11-22
status: implementacja
---

# Nowe słowniki

Ten dokument proponuje 3 nowe słowniki dla Generatora COI. Dotyczy kryterium oceny II „Nowy słownik”.

## 1. Po co

Formularze papierowe mają zamknięte listy wartości. Generator nie ma dla nich słownika. Dziś urzędnik musi wpisać te wartości ręcznie w każdym formularzu.

Dokument „Hacknation - Słowniki” zaprasza do propozycji:

> Jeżeli podczas analizy formularzy widzisz możliwość zastosowania innego nowego słownika – zaproponuj jego nazwę, strukturę i zastosowanie w formularzu (opcjonalne rozszerzenie).

Dokument „Reguły techniczne” opisuje pole ze słownikiem. Pole ma `dictionaryName`. Tablica `options` jest wtedy pusta: „jeżeli pole korzysta ze słownika, to tablica jest pusta”.

Słownik pasuje tylko do pól SELECT, RADIO i CHECKBOX.

## 2. Struktura wpisu słownika

Każdy wpis ma 3 atrybuty. To ta sama struktura co element tablicy `options`.

| Atrybut | Znaczenie |
|---|---|
| `id` | Identyfikator wpisu. W JSON-ach referencyjnych `id` ma tę samą wartość co `name`. My stosujemy tę samą zasadę. |
| `name` | Tekst, który widzi wnioskodawca. |
| `techName` | Nazwa techniczna. Powstaje z `name` przez funkcję `slug` z `src/formgen/compose/slug.py`. Ta sama funkcja tworzy `techName` pól. |

Zasady funkcji `slug`: małe litery, polskie znaki bez ogonków, każdy ciąg innych znaków to jeden znak `_`, najwyżej 60 znaków.

Przykład wpisu:

```json
{"id": "podatek rolny", "name": "podatek rolny", "techName": "podatek_rolny"}
```

COI może nadać wpisom identyfikatory UUID przy rejestracji słownika. Wtedy `name` i `techName` zostają bez zmian.

## 3. Słownik „Dyscypliny sportowe”

- **Nazwa:** `Dyscypliny sportowe`.
- **Źródło:** formularz 09 (wniosek o stypendium sportowe), sekcja papierowa „Dyscypliny sportowe”. Tekst: `docs/02-materialy/tekst/02-materialy/organizator/9. …/Wniosek o przyznanie stypendium.docx.txt`, wiersze 51–72.
- **Pola:** formularz 09. Wynik `data/output/09_stypendium_sportowe.json` (22.11) ma pole CHECKBOX `wybierz_dyscypliny_sportowe` (20 opcji) oraz CHECKBOX `inna_dyscyplina` z wartościami słownika i `tooltipMessage` „Proponowany słownik: Dyscypliny sportowe”.
- **Typ pola:** CHECKBOX. Formularz mówi „wybierz konkretne dyscypliny z listy”. Wnioskodawca może wybrać kilka dyscyplin.
- **Poza słownikiem:** „rodzaj dyscypliny” (zespołowa, indywidualna – inna, indywidualna – lekkoatletyka) to zwykłe pole RADIO. Te 3 opcje nie tworzą słownika.

| `name` | `techName` |
|---|---|
| gimnastyka artystyczna | `gimnastyka_artystyczna` |
| hokej | `hokej` |
| karate | `karate` |
| kolarstwo | `kolarstwo` |
| koszykówka | `koszykowka` |
| lekkoatletyka | `lekkoatletyka` |
| łucznictwo | `lucznictwo` |
| łyżwiarstwo | `lyzwiarstwo` |
| narciarstwo klasyczne | `narciarstwo_klasyczne` |
| piłka nożna | `pilka_nozna` |
| piłka ręczna | `pilka_reczna` |
| piłka siatkowa | `pilka_siatkowa` |
| piłka wodna | `pilka_wodna` |
| sport motocyklowy | `sport_motocyklowy` |
| sporty walki | `sporty_walki` |
| sporty wodne | `sporty_wodne` |
| tenis stołowy | `tenis_stolowy` |
| tenis ziemny | `tenis_ziemny` |
| unihokej | `unihokej` |
| zapasy | `zapasy` |
| Inna dyscyplina | `inna_dyscyplina` |

## 4. Słownik „Rasy psów wymagające zezwolenia”

- **Nazwa:** `Rasy psów wymagające zezwolenia`.
- **Źródło:** Rozporządzenie MSWiA z 28 kwietnia 2003 r. w sprawie wykazu ras psów uznawanych za agresywne (Dz.U. 2003 nr 77 poz. 687). Rozporządzenie wymienia 11 ras. Ten sam formularz papierowy obejmuje też charty. Podstawa: Prawo łowieckie, art. 10, i rozporządzenie z 2010 r. o chartach. Dlatego słownik ma 2 dodatkowe wartości: „chart rasowy” i „mieszaniec charta”.
- **Pola:** formularz 07, pole `rasa_psa` w `data/output/07_psy_rasy_agresywne.json`.
- **Typ pola:** SELECT. Jeden pies ma jedną rasę.

| `name` | `techName` |
|---|---|
| amerykański pit bull terrier | `amerykanski_pit_bull_terrier` |
| pies z Majorki (Perro de Presa Mallorquin) | `pies_z_majorki_perro_de_presa_mallorquin` |
| buldog amerykański | `buldog_amerykanski` |
| dog argentyński | `dog_argentynski` |
| pies kanaryjski (Perro de Presa Canario) | `pies_kanaryjski_perro_de_presa_canario` |
| tosa inu | `tosa_inu` |
| rottweiler | `rottweiler` |
| akbash dog | `akbash_dog` |
| anatolian karabash | `anatolian_karabash` |
| moskiewski stróżujący | `moskiewski_strozujacy` |
| owczarek kaukaski | `owczarek_kaukaski` |
| chart rasowy | `chart_rasowy` |
| mieszaniec charta | `mieszaniec_charta` |

## 5. Słownik „Rodzaje podatków i opłat lokalnych”

- **Nazwa:** `Rodzaje podatków i opłat lokalnych`.
- **Źródło:** ustawa o podatkach i opłatach lokalnych, ustawa o podatku rolnym, ustawa o podatku leśnym, ustawa o utrzymaniu czystości i porządku w gminach. Formularz papierowy 05 ma tekst „z tytułu … (rodzaj podatku)”.
- **Pola:** formularz 05. JSON referencyjny ma pola TEXT_FIELD `podatek_ktorego_dotyczy_nadplata` i `nazwa_podatku`. Nasz wynik `data/output/05_nadplata_podatku.json` (22.11) ma pole SELECT `nazwa_podatku` z wartościami słownika i `tooltipMessage` „Proponowany słownik: Rodzaje podatków i opłat lokalnych”; pola `rodzaj_podatku` w nim nie ma.
- **Typ pola:** SELECT. Jeden wniosek dotyczy jednego podatku.
- **Uwaga:** gmina może skrócić listę. Zostawia wtedy tylko podatki i opłaty, które pobiera.

| `name` | `techName` |
|---|---|
| podatek od nieruchomości | `podatek_od_nieruchomosci` |
| podatek rolny | `podatek_rolny` |
| podatek leśny | `podatek_lesny` |
| podatek od środków transportowych | `podatek_od_srodkow_transportowych` |
| łączne zobowiązanie pieniężne | `laczne_zobowiazanie_pieniezne` |
| opłata skarbowa | `oplata_skarbowa` |
| opłata targowa | `oplata_targowa` |
| opłata miejscowa | `oplata_miejscowa` |
| opłata uzdrowiskowa | `oplata_uzdrowiskowa` |
| opłata reklamowa | `oplata_reklamowa` |
| opłata od posiadania psów | `oplata_od_posiadania_psow` |
| opłata za gospodarowanie odpadami komunalnymi | `oplata_za_gospodarowanie_odpadami_komunalnymi` |

## 6. Forma w JSON

### Dziś: wartości w `options`

Generator nie zna jeszcze naszych słowników. Nieznana wartość `dictionaryName` może zatrzymać import. Dlatego wynik ma wartości bezpośrednio w `options`. `dictionaryName` zostaje `null`. `tooltipMessage` podaje nazwę proponowanego słownika.

Fragment z `data/output/07_psy_rasy_agresywne.json` (lista skrócona):

```json
{
  "type": "SELECT",
  "techName": "rasa_psa",
  "title": "Rasa psa",
  "options": [
    {"id": "amerykański pit bull terrier", "name": "amerykański pit bull terrier", "techName": "amerykanski_pit_bull_terrier"},
    {"id": "rottweiler", "name": "rottweiler", "techName": "rottweiler"},
    {"id": "mieszaniec charta", "name": "mieszaniec charta", "techName": "mieszaniec_charta"}
  ],
  "tooltipMessage": "Proponowany słownik: Rasy psów wymagające zezwolenia",
  "dictionaryName": null
}
```

### Po rejestracji słownika w Generatorze

COI rejestruje słownik pod proponowaną nazwą. Wtedy pole ma `dictionaryName` i pustą tablicę `options`:

```json
{
  "type": "SELECT",
  "techName": "rasa_psa",
  "title": "Rasa psa",
  "options": [],
  "dictionaryName": "Rasy psów wymagające zezwolenia"
}
```

### Pytanie otwarte

Pytanie do mentora o formę nowego słownika w JSON nie ma jeszcze odpowiedzi. Do odpowiedzi stosujemy wariant z `options`.

## 7. Jak to działa w kodzie

- `PROPOSED` w `src/formgen/compose/dictionaries.py` to tabela 3 słowników: nazwa, typ pola, wartości, wzorzec etykiety.
- `proposed_for(label)` zwraca słownik, którego wzorzec pasuje do etykiety pola.
- `with_proposed(spec)` wpisuje typ pola, wartości i `tooltip`. Robi to tylko wtedy, gdy pole nie ma słownika predefiniowanego i ma mniej niż 2 opcje. Opcje z dokumentu mają pierwszeństwo.
- `src/formgen/extract/extractor.py` (ścieżka LLM) stosuje `with_proposed` do każdego pola.
- `src/formgen/extract/heuristic.py` (ścieżka bez LLM) stosuje `with_proposed` do pól z linią do wypełnienia.
