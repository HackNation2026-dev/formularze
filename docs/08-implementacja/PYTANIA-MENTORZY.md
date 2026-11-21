---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# 4 pytania do mentorów COI (styl ASD-STE100)

Zasady tekstu: jedno zdanie, jedna myśl. Zdanie ma najwyżej 20 słów. Jeden termin zawsze znaczy to samo.

Terminy w tym dokumencie:
- **JSON referencyjny**: jeden z dwóch gotowych plików JSON od organizatora (numer porządkowy, nadpłata podatku).
- **Dokumenty organizatora**: reguły techniczne, opis pliku JSON, opis słowników, opis danych inicjalnych.
- **Generator**: system COI, który wczytuje nasz plik JSON i robi z niego formularz.
- **Import**: wczytanie naszego pliku JSON do Generatora.

---

## Odpowiedzi, które już mamy w dokumentach organizatora

Sprawdziliśmy treść zadania, regulamin, reguły techniczne i standardy projektowania. Regulamin nie zawiera wymagań technicznych. Pozostałe dokumenty odpowiadają na większość pytań.

| Temat | Odpowiedź | Źródło |
|---|---|---|
| Pisownia (`repeatingSectionGrid`, `CONSENT_SECTION`, `MAIN`, `FINISH`) | Trzymamy się JSON-a referencyjnego | Zadanie, pkt 3.2.I: struktura ma być „zgodna ze strukturą oczekiwaną przez aplikację”, a wzorem jest plik wynikowy z pkt 3.1.I |
| Słowniki adresu | Słowniki z pliku „Słowniki”: Kraje, Województwo, Powiat, Gmina, Miejscowość, Numery kierunkowe | **Mentor B. Krajewski, Discord 21.11 17:18.** Przykłady mają odpowiedniki z rejestrów (`TERYT_*`), które różnią się szczegółami |
| Dane z rejestru | „Twoje dane” tylko do odczytu. Adres i kontakt wypełnione, ale do edycji | Standardy: „Twoje dane” mają „Pole tylko do odczytu”, adres nie ma. Kontakt: „Możesz je zmienić lub usunąć”. JSON referencyjny robi to samo |
| Walidatory | Dodajemy `REQUIRED`, `PESEL`, `NIP`, `REGON`, `EMAIL`, `ZIP_CODE` | Standardy podają walidację przy każdym polu. Reguły podają listę walidatorów. Kryteria oceny: punkt V „Walidacje pól” |
| Ostatnia strona | `SECTION` z `TEXT_BLOCK` | Standardy: na ostatniej stronie „pole typu blok tekstu”. JSON referencyjny robi to samo. Tylko reguły techniczne mówią `INFO_SECTION` |
| Format odpowiedzi API | Tylko konfiguracja formularza, bez opakowania | Zadanie, sekcja 5: „aplikacja zwraca dokument JSON zawierający konfigurację formularza przygotowaną do importu” |
| Nowy słownik | Osobny próg punktowy | Kryteria oceny: punkt II „Nowy słownik” |
| Formaty na obronie | Te same 8 formatów | Zadanie, sekcja 5: lista obsługiwanych formatów |
| Formularz 9 | Jeden plik JSON | Nazwa folderu od organizatora: „Połączenie 3 wniosków w 1” |
| Obrazy Docker | Oficjalny obraz bazowy z naszą warstwą jest poprawny | Zadanie, sekcja 5: „wykorzystywać oficjalne obrazy bazowe” |

Uwaga: kryteria oceny nie wymieniają aplikacji do wizualizacji (pkt 3.3.V). Punkt V w kryteriach to walidacje. Wizualizacja może dać punkty tylko za intuicyjność, nie za kompletność.

Nasz kod już robi wszystko z tabeli powyżej.

## Odpowiedzi mentorów

- **Architektura obrazu Docker:** jury uruchamia na x86. Nasz obraz jest zbudowany i przetestowany na x86 (Legion), arm64 nie jest potrzebny.
- **Słowniki:** nazwy i wartości z pliku „Słowniki”. Kod używa ich od wersji z 21.11 wieczorem.

## Pytania, na które dokumenty nie odpowiadają

### Pytanie 1. Sprzęt na obronie

**Zapytaj:**
„Na jakim komputerze uruchomimy rozwiązanie podczas obrony? Czy ten komputer ma kartę graficzną?”

**Kontekst:**
Nasz model językowy działa lokalnie. Na karcie graficznej jest kilka razy szybszy niż na samym procesorze.

**Po co pytamy:**
Odpowiedź decyduje, jakiego modelu używamy na obronie.

**Jeśli dopytają o czas:**
Prosty formularz trwa 16 s na karcie graficznej i około 150 s na samym procesorze.

### Pytanie 2. Sposób oceny pliku JSON

**Zapytaj:**
„Jak porównujecie nasz plik JSON z plikiem referencyjnym? Pole po polu, czy przez import do Generatora?”

**Kontekst:**
Plik referencyjny nie ma walidatorów, na przykład sprawdzenia numeru PESEL. Standardy projektowania wymagają walidatorów, więc my je dodajemy.

**Po co pytamy:**
Przy porównaniu pole po polu dodatkowe walidatory mogą wyglądać jak błąd.

**Jeśli dopytają o wynik:**
Zgodność pól z dwoma plikami referencyjnymi wynosi około 0,9.

### Pytanie 3. Strona alternatywna

**Zapytaj:**
„Standardy każą używać stron alternatywnych. Jak zapisać warunkowe przejście między stronami w pliku JSON?”

**Kontekst:**
Strona alternatywna to strona, którą użytkownik widzi tylko po wybraniu konkretnej opcji. Przejście między stronami w `flow.links` nie ma pola na warunek.

**Po co pytamy:**
Formularz 9 zawiera trzy wnioski. Każdy wniosek mógłby mieć swoją stronę.

**Jeśli dopytają, jak to robimy teraz:**
Mamy jedną stronę z wyborem rodzaju wniosku. Sekcje dla danego wniosku pokazujemy dopiero po wyborze.

## Tematy odłożone

Te tematy nie blokują naszej pracy. Użyj ich tylko, gdy mentor sam o nie zapyta.

- **LibreOffice i licencja MPL-2.0:** nie potrzebujemy tego. Pliki `.doc` czytamy programem Apache Tika z licencją Apache-2.0.
- **Rozszerzenie `.JPE`:** aplikacja już je przyjmuje.
- **Google Magika:** program sprawdza typ pliku. Działa lokalnie, bez Internetu, licencja Apache-2.0.

## Słowniczek

- **JSONata:** język, w którym zapisujemy warunek „pokaż pole, gdy użytkownik wybrał opcję X”.
- **SHOW, READ_ONLY:** dwa typy warunków. `SHOW` pokazuje pole. `READ_ONLY` blokuje edycję pola.
- **techName:** nazwa techniczna pola, na przykład `numer_pesel`. Warunki JSONata używają tej nazwy.
- **MLPZ:** dane zalogowanej osoby.
- **PESEL, PESEL_ADDRESS:** dane z rejestru PESEL.
- **Fallback heurystyczny:** gdy model nie odpowie, aplikacja buduje formularz z układu dokumentu. Wtedy też zwraca poprawny plik JSON.
