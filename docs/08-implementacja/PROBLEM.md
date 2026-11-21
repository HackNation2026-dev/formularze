---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# PROBLEM: Cyfryzacja formularzy (HackNation 2026, COI)

Jedno zdanie: **urzędnik wrzuca plik z papierowym formularzem, system zwraca JSON gotowy do importu w Generatorze Formularzy COI, który opisuje nowoczesny, wielostronicowy formularz elektroniczny zgodny ze standardami mObywatel.**

## 1. Kto i po co
- Użytkownik: urzędnik COI / gminy, który cyfryzuje formularze e-usług. Dziś robi to ręcznie: analiza procesu, identyfikacja pól, przeprojektowanie, walidacje. Dni pracy na formularz.
- Cel: skrócić ten czas do minut. Wynik = **szkic do poprawy**, nie finalny produkt. Urzędnik poprawia, nie projektuje od zera.
- Oceniają: jury COI (3+ osoby), na żywo, na **nowych** plikach podczas obrony. Nagroda 25 000 zł, 1 miejsce.

## 2. Wejście
Jeden plik, jeden z formatów: `.pdf .doc .docx .ods .xlsx .jpg .jpeg .png` (w praktyce także `.JPE`, wielkie litery).
Treść: blankiet formularza urzędowego zaprojektowany do ręcznego wypełnienia: kropki `.......`, kratki `□`, tabele, pola numerowane `1. 2. 3.`, sekcje `A. B.1 B.2`, podstawy prawne, pouczenia, miejsce na podpis i datę.
Rozmiar: 1 do 16 stron. PDF ma warstwę tekstową, brak AcroForm. Obrazy = render A4 200 dpi, strony sklejone pionowo (do 37 000 px wysokości).
Zestaw: 2 formularze referencyjne (z gotowym JSON) + 7 do oceny. Pliki w `data/input/`.

## 3. Wyjście
JSON `FormDefinition` (`data/input/02_przyklady_json/*.json` = wzór). Struktura: `title`, `tabs[]` (strony MAIN... + 1 FINISH), w stronie `questions[]` = sekcje (`SECTION` / `REPEATING_SECTION`), w sekcji `repeatingSectionGrid[]` = pola (13 typów), `states[]` z jsonata (widoczność warunkowa), `flow.links[]` (nawigacja między stronami), słowniki (`dictionaryName`), dane inicjalne (`defaultValue: "MLPZ.name"`, `EXTERNAL_SYSTEM`, `readOnly`), walidatory (`REQUIRED`, `PESEL`, `NIP`, `REGON`, `EMAIL`, `ZIP_CODE`, ...).

Kluczowe: wyjście **nie jest kopią papieru 1:1**. To przeprojektowany formularz:
- strona 1 "Dane" = szablon (urząd/organ, podmiot wniosku, twoje dane z rejestru, adres, dane podmiotu, pełnomocnictwo, opłata skarbowa) – zależy tylko od tego, KTO może składać wniosek (osoba / firma / oba),
- strony 2..n = "przedmiot wniosku" – to jedyna część, którą trzeba naprawdę wyekstrahować z papieru i pogrupować tematycznie,
- przedostatnia = dane do kontaktu + zgody (szablon),
- ostatnia FINISH = podgląd (szablon).
Pola papierowe "imię, nazwisko, PESEL, adres, data, miejscowość, podpis" znikają – zastępuje je szablon i rejestry.

## 4. Twarde ograniczenia
- Python >= 3.14 (albo Java 21). Tylko open source, **bez copyleft** (AGPL/GPL zakaz: PyMuPDF, Ghostscript, marker, surya, antiword).
- **Zero zewnętrznych API w runtime.** Żadnego OpenAI/Anthropic/Gemini, SaaS, MCP. LLM tylko lokalny. (API wolno używać do pisania kodu.)
- REST API, upload 1 pliku, walidacja MIME (treść == rozszerzenie), nazwa pliku <= 250 znaków bez `; : > < / \ | ' * % $`, max rozmiar z konfiguracji, plik tylko w RAM/tmp na czas żądania, JWT konfigurowalne.
- Docker: oficjalne obrazy, lekkie, jawne wersje, bez `latest`, non-root, tylko potrzebne porty, sekrety przez env.
- README: build, run, konfiguracja, opis API. Dokumentacja architektury.
- Działa offline, na żywo, na nieznanym formularzu, w rozsądnym czasie (minuty, nie godziny) na laptopie/CPU.

## 5. Problemy do rozwiązania (po sznurku)
P1. **Ingest 7 formatów -> jedna reprezentacja.** Tekst + układ (bloki, tabele, kolejność, strona). DOC binarny bez GPL-owych narzędzi. Obrazy: OCR po polsku, cięcie na strony. XLSX/ODS: komórki i scalenia jako układ.
P2. **Rozpoznanie struktury papieru.** Co jest sekcją, co etykietą pola, co opcją wyboru (kratki), co tabelą, co szumem (podstawa prawna, pouczenie, podpis, data, nagłówek urzędu). Wiele formularzy w jednym pliku (09: 3 wnioski).
P3. **Klasyfikacja wnioskodawcy.** Osoba fizyczna / firma / oba / wariant (najemca, wspólnota...) -> wybór szablonu strony 1 i opcji "Podmiot wniosku".
P4. **Ekstrakcja przedmiotu wniosku.** Pola -> typ komponentu (13 typów), etykieta w prostym języku, opcje, obligatoryjność, walidator, grupowanie w sekcje tematyczne, podział na strony tematyczne, sekcje powtarzalne (wiele osób/działek/pojazdów).
P5. **Zależności.** "wypełnić tylko gdy zaznaczono B.1.2" -> `states[SHOW]` z poprawną składnią jsonata odwołującą się do istniejących techName. Strony alternatywne gdy od wyboru zależy cały dalszy etap.
P6. **Słowniki i dane inicjalne.** Pola adresowe -> `Kraje`, `TERYT_4G_DOWODOWY`; dane osoby -> `MLPZ.*`/`PESEL.*` readOnly. Propozycja nowego słownika gdy jest lista zamknięta (dyscypliny sportowe, rasy psów, rodzaje podatku).
P7. **Zgodność strukturalna.** Deterministyczny walidator reguł technicznych (>=2 taby, FINISH tylko INFO/TEXT_BLOCK, każde pole w sekcji, brak sekcji w sekcji, flow spójny, UUID, grid x/y/rows/cols/questionOrder, jsonata wskazuje istniejące pola). Zero niepoprawnego JSON-a na wyjściu, nawet gdy model halucynuje.
P8. **Lokalny model w budżecie.** 16 GB RAM / CPU w Dockerze. Mały model (3B–8B) + structured output (JSON schema / grammar) + deterministyczny szkielet, tak aby model generował tylko to, czego nie da się wyliczyć.
P9. **Produkt.** API + prosty frontend (upload, batch, podgląd JSON) + wizualizator formularza z JSON-a (jak screeny eUsługi) + Docker + README + prezentacja 10 slajdów + film 3 min + 7 JSON-ów wynikowych.

## 6. Kryteria sukcesu (nasze, mierzalne)
- S1. API przyjmuje wszystkie 16 plików z `01_przyklady_formularze` (2 formularze × 8 formatów) i zwraca JSON przechodzący walidator P7. 100%.
- S2. Golden test: dla 01 i 05 pokrycie pól referencyjnych (techName/title/type per tab, dopasowanie rozmyte) >= 80%, stany SHOW dla podmiotu wniosku i adresu 100%.
- S3. Cross-format: ten sam formularz z PDF i z PNG daje JSON różniący się < 10% pól.
- S4. 7 formularzy do oceny -> 7 JSON-ów, każdy otwiera się w naszym wizualizatorze i wygląda jak eUsługa.
- S5. Czas na formularz 1-stronicowy < 60 s na M4, < 5 min na CPU w Dockerze. Formularz 16-stronicowy < 10 min.
- S6. `docker compose up` od zera działa na czystej maszynie.

## 7. Poza zakresem
- Wizualizacja dokumentu CRWDE (jawnie wyłączona w standardach).
- Integracja z rejestrami (tylko konfiguracja `defaultValue`).
- Idealny JSON bez poprawek urzędnika. Cel: szkic 80%, nie 100%.
- Obsługa wypełnionych formularzy (wejście = blankiet).

## 8. Pytania otwarte (do mentorów COI)
- `validation` w referencjach puste – czy jury oczekuje walidatorów? (zakładamy: tak, bonus).
- Słowniki: doc mówi Województwo/Powiat/Gmina/Miejscowość, referencje używają `TERYT_DOWODOWY` / `TERYT_4G_DOWODOWY`. Która nazwa jest importowalna?
- `repeatingSectionGrid` (referencje) vs `repetingSectionGrid` (schema) – zakładamy referencje.
- LibreOffice (MPL) jako osobny proces do `.doc` – akceptowalne?
- Tokeny dla 20 zespołów – do czego?

## 9. Kolejne kroki
1. Decyzja architektoniczna: parser deterministyczny + lokalny LLM z JSON schema; szablony strony 1 / kontakt / FINISH jako kod, nie prompt. Zapis w `docs/architektura.md`.
2. Spike: lokalny model na M4 (Qwen3 8B lub Bielik 11B przez llama.cpp) na formularzu 05 -> czy wyciąga pola przedmiotu wniosku sensownie. 1–2 h, decyduje o reszcie.
3. Walidator P7 + golden test S2 (pydantic + pytest) zanim powstanie ekstrakcja. Testy pierwsze, bo to jedyna twarda miara.
4. Pipeline P1 per format, najpierw PDF/DOCX (tekst), potem obrazy (OCR), na końcu DOC/ODS/XLSX.
5. API + Docker + frontend + wizualizator równolegle, gdy pipeline daje pierwszy JSON.
