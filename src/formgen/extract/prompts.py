"""Prompts (Polish) for the two LLM stages."""

SYSTEM = """Jesteś analitykiem cyfryzującym papierowe formularze urzędowe na formularze elektroniczne mObywatel.
Odpowiadasz wyłącznie poprawnym JSON zgodnym ze schematem. Bez komentarzy."""

GLOBAL_USER = """Poniżej tekst papierowego formularza (nagłówki jako '## ', pola do wpisania jako '____', kratki jako '☐', tabele w [tabela]).

Ustal:
1. title: krótki tytuł usługi dla obywatela. Zachowaj rodzaj dokumentu z formularza: "Wniosek o ...", "Zgłoszenie ...", "Deklaracja ..." lub "Oświadczenie ..." (deklaracji nie zamieniaj na wniosek). Bez odwołań do przepisów prawa, bez nazwy urzędu. Max 120 znaków.
2. office_name: nazwa urzędu lub organu, do którego składa się formularz (np. "Urząd Gminy Ulan-Majorat", "Prezydent Miasta Gdyni"). Pusty string, gdy brak.
3. office_is_organ: true, gdy adresatem jest organ (Wójt, Burmistrz, Prezydent Miasta, Starosta), false gdy urząd.
4. applicant_self / applicant_other_person / applicant_legal_entity: kto może składać ten formularz.
   - applicant_self=true zawsze, gdy osoba fizyczna może wnioskować we własnym imieniu.
   - applicant_other_person=true, gdy formularz przewiduje pełnomocnika osoby fizycznej lub działanie w imieniu innej osoby.
   - applicant_legal_entity=true, gdy formularz zawiera dane firmy, instytucji, NIP, REGON, KRS, nazwę podmiotu, reprezentanta.
5. reasoning: jedno zdanie uzasadnienia.

TEKST FORMULARZA:
{text}"""

SECTIONS_USER = """Poniżej fragment tekstu papierowego formularza. Nagłówki jako '## ', pola do wpisania jako '____', kratki wyboru jako '☐', tabele w [tabela].

Wyodrębnij WYŁĄCZNIE pola dotyczące PRZEDMIOTU SPRAWY, pogrupowane w sekcje tematyczne i strony.

POMIŃ (są obsługiwane automatycznie przez szablon):
- dane wnioskodawcy: imię, nazwisko, PESEL, NIP, nazwa firmy, adres zamieszkania/siedziby/korespondencyjny, dane pełnomocnika, dane reprezentanta
- dane kontaktowe (telefon, e-mail), zgody RODO, oświadczenia o prawdziwości danych, klauzule informacyjne
- nazwę i adres urzędu, miejscowość i datę, podpis, podstawę prawną, pouczenia, instrukcję wypełniania, numery stron, załącznik nr
Pomijasz tylko te pola, nie całe sekcje: pozostałe pola sekcji z danymi osoby (np. lista kratek pod jej danymi) wyodrębnij. Przejrzyj cały fragment do końca.
Jeżeli po pominięciu nie zostaje nic, zwróć pustą listę sections.

ZASADY:
- page_title: nazwa strony tematycznej (np. "Informacje o nadpłacie", "Lokalizacja budynku"). Pokrewne sekcje mają ten sam page_title. Zwykle 1-3 strony.
- title: nazwa sekcji w prostym języku. Sekcja grupuje 1-8 pól.
- label: etykieta pola w prostym, uprzejmym języku, bez numerów pozycji ("3. PESEL" -> "PESEL"), bez skrótów.
- kind: TEXT_FIELD (krótki tekst), TEXTAREA (opis, uzasadnienie), NUMBER (kwota, liczba, powierzchnia), DATEPICKER (data), RADIO (jedna opcja z kratek), CHECKBOX (wiele opcji), SELECT (jedna opcja z listy > 5 opcji), FILE_UPLOADER (załącznik, dokument do dołączenia), TEXT_BLOCK (informacja dla użytkownika, bez wpisywania).
- options: dla RADIO/CHECKBOX/SELECT dokładne nazwy opcji z formularza (bez numerów i kratek).
- Lista kratek '☐' pod jednym nagłówkiem to JEDNO pole, a options to WSZYSTKIE jej pozycje w kolejności, choćby było ich kilkadziesiąt. Każdy nagłówek z własną listą kratek to osobne pole; nie łącz list. Polecenie w liczbie mnogiej ("wskaż rodzaje", "wybierz ... z listy") lub brak ograniczenia do jednej kratki oznacza CHECKBOX, także dla długiej listy. Pozycja bez kratki z miejscem do wpisania (np. "Inny ____") to osobne pole TEXT_FIELD, nie opcja.
- Lista wykluczających się wariantów po zdaniu typu "proszę:", "wybierz", "zaznacz" (np. "1) zaliczyć ... 2) zwrócić ...") to JEDNO pole RADIO z opcjami, nie osobne pola tekstowe. Pole do wpisania przy wariancie (np. "z tytułu ____") to osobne pole z visible_when na tę opcję.
- required: false tylko, gdy formularz mówi "opcjonalnie", "jeżeli dotyczy", "nieobowiązkowe".
- validator: EMAIL, PESEL, NIP, REGON, ZIP_CODE (kod pocztowy), EPUAP, ADE, SERIAL_NUMBER_ID_CARD lub "".
- repeating: true, gdy sekcję wypełnia się dla wielu elementów (kilka osób, działek, pojazdów, nieruchomości).
- visible_when: gdy pole lub sekcja ma być widoczne tylko po wybraniu konkretnej opcji innego pola RADIO/CHECKBOX/SELECT z tego fragmentu: field_label = etykieta tego pola, equals = nazwa opcji. Inaczej null.
- description: krótka wskazówka z formularza (np. "wypełnić, jeżeli nieruchomość nie ma nadanego adresu") lub "".
- Nie wymyślaj pól, których nie ma w tekście. Każda etykieta musi wynikać z tekstu.
- Nie powtarzaj tej samej etykiety w jednej sekcji.

PRZYKŁAD. Fragment tekstu:
  Kwotę nadpłaty proszę:
  ☐ 1) zaliczyć na poczet przyszłego zobowiązania podatkowego z tytułu ____
  ☐ 2) zwrócić przelewem na wskazany rachunek
Poprawny wynik (jedna sekcja, trzy pola):
  {{"page_title": "Informacje o nadpłacie", "title": "Rozliczenie nadpłaty", "fields": [
    {{"label": "Wybierz, co mamy zrobić z nadpłatą", "kind": "RADIO", "options": ["Zaliczyć na poczet przyszłego zobowiązania podatkowego", "Zwrócić przelewem na rachunek bankowy"], "required": true}},
    {{"label": "Nazwa podatku", "kind": "TEXT_FIELD", "visible_when": {{"field_label": "Wybierz, co mamy zrobić z nadpłatą", "equals": "Zaliczyć na poczet przyszłego zobowiązania podatkowego"}}}},
    {{"label": "Numer rachunku", "kind": "TEXT_FIELD", "visible_when": {{"field_label": "Wybierz, co mamy zrobić z nadpłatą", "equals": "Zwrócić przelewem na rachunek bankowy"}}}}]}}
PRZYKŁAD list wielokrotnego wyboru. Fragment tekstu:
  Wskaż poziomy, a następnie wybierz języki z listy:
  ☐ podstawowy
  ☐ zaawansowany
  Języki:
  ☐ angielski
  ☐ niemiecki
  ☐ włoski
  Inny język ____
Poprawne pola (dwie listy CHECKBOX i osobne pole tekstowe):
  {{"label": "Poziomy", "kind": "CHECKBOX", "options": ["Podstawowy", "Zaawansowany"]}},
  {{"label": "Języki", "kind": "CHECKBOX", "options": ["Angielski", "Niemiecki", "Włoski"]}},
  {{"label": "Inny język", "kind": "TEXT_FIELD", "required": false}}
Lista załączników ("w załączeniu: 1) korekta deklaracji 2) ____") to osobne pola FILE_UPLOADER, po jednym na wymieniony dokument ("Plik korekty deklaracji"); nigdy RADIO. Puste pozycje "____" pomijaj.

TEKST ({pages}):
{text}"""
