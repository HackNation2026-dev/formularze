---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

Zaktualizuj board Miro „HackNation 2026: architektura” (https://miro.com/app/board/uXjVELOtLzE=/) w części COI tak, aby odzwierciedlał aktualny stan repozytorium (stan na 21 listopada 2026, godz. 16:00). Nie ruszaj części UZP. Zachowaj istniejący układ ramek i styl sticky notes. Tam, gdzie treść się zmienia, edytuj istniejące karty zamiast dodawać nowe. Dodaj nowe karty tylko tam, gdzie to zaznaczam. Na końcu wypisz, co zmieniłeś.

1. Ramka „COI: kolejność budowy”. Dopisz status na końcu każdej pozycji i pokoloruj kartę: zielony = zrobione, żółty = częściowo, szary = do zrobienia.
   1. IR, kompilator i walidator na dwóch referencjach — ZROBIONE (IR = FormSpec w compose/spec.py, kompilator compose/assemble.py, walidator schema/rules.py + lint JSONata; F1 0,97 na obu goldenach).
   2. Szkielet REST: walidacja pliku, tmp, JWT, Docker non-root — ZROBIONE (FastAPI, magika jako detektor MIME, 78 testów).
   3. Adaptery 8 formatów na 9 formularzach — ZROBIONE (pdf, docx także po konwersji z PDF, xlsx, ods, jpg, png, skan PDF; .doc przez Tika, a bez Tiki awaryjny parser binarny).
   4. Ekstraktor heurystyczny bez LLM — ZROBIONE (extract/heuristic.py, automatyczny fallback, gdy LLM nie odpowiada).
   5. Kontener LLM z gramatyką — ZROBIONE (llama.cpp server, JSON Schema jako gramatyka; model Qwen3.5-4B Q4, nie Bielik; A/B z Bielikiem w toku).
   6. Słowniki, dane inicjalne, walidatory PESEL/NIP/REGON — CZĘŚCIOWO (słowniki Kraje i TERYT oraz dane MLPZ/PESEL są w szablonie; walidatory jako nazwy w polu validation; brak implementacji sum kontrolnych i brak propozycji nowego słownika).
   7. Zależności i JSONata — ZROBIONE (generator zapytań, warunki z LLM jako SHOW, lint odwołań).
   8. GUI: upload, JSON, renderer e-usługi — DO ZROBIENIA (zespół frontendu, brief w docs/FRONTEND-BRIEF.md).
   9. Test offline, README, prezentacja, film — CZĘŚCIOWO (README gotowe, reszta nie).

2. Ramka „COI: stos”. Zmień treść kart:
   - „Odczyt 8 formatów”: „Parsery natywne z układem: pdfplumber i pypdfium2 (PDF), python-docx z obsługą pól tekstowych z konwersji PDF (DOCX), openpyxl (XLSX), content.xml (ODS), Tesseract pol (JPG, PNG, skany PDF). Apache Tika tylko dla binarnego .doc, z awaryjnym parserem bez Tiki. Wyjście: wspólny model dokumentu z pozycjami, nagłówkami, kratkami (☐) i polami do wpisania (____).”
   - „Ekstrakcja”: „Dwa ekstraktory o tym samym interfejsie: LLM (wywołanie globalne, potem wywołania per fragment 4500 znaków, płaski schemat pośredni, grounding etykiet w tekście źródłowym) oraz heurystyczny bez LLM (nagłówki, kratki, pola ____). Heurystyczny jest automatycznym fallbackiem przy awarii lub timeoucie LLM.”
   - „Model”: „llama.cpp server, Qwen3.5-4B Q4_K_M (Apache-2.0), wyjście wymuszone gramatyką z JSON Schema, reasoning wyłączony, temperatura 0. Zmierzone na M4: 12 tok/s, formularz 1–2 strony 65–130 s. Alternatywa Bielik 4.5B Q4 do zmierzenia.”
   - „Kompilacja i walidacja”: „IR (FormSpec) do JSON COI. Strona Dane, Kontakt i FINISH oraz sekcje adresowe, JSONata, grid i flow generowane deterministycznie z szablonów; walidacja dwuetapowa: pydantic, potem reguły techniczne COI i lint JSONata; niepoprawny JSON nigdy nie opuszcza API.”
   - „Dostarczenie”: bez zmian, dopisz „obrazy przypięte tagami, digesty do dodania; Docker na maszynie dev jeszcze nie przetestowany”.

3. Ramka „COI: zasady architektury”. Dodaj dwie karty:
   - „LLM proponuje, kod decyduje”: „Model zwraca tylko przedmiot wniosku w płaskim schemacie. Wszystko, co da się wyliczyć (strona 1, kontakt, zgody, podgląd, adresy, JSONata, UUID, grid, flow), buduje kod. Kto może wnioskować (osoba, inna osoba, podmiot) jest rozpoznawane deterministycznie ze słownictwa formularza, nie przez LLM.”
   - „Nigdy nie zawiedź użytkownika”: „Awaria LLM lub timeout przełącza na ekstraktor heurystyczny; brak Tiki przełącza na awaryjny parser .doc; nagłówek X-Extractor mówi, która ścieżka zadziałała.”
   Przy karcie „Pętla naprawy” dopisz „DO ZROBIENIA”, a przy „IR jako kontrakt” dopisz „wersjonowanie IR do dodania”.

4. Ramka „COI: do zatwierdzenia”. Dopisz odpowiedzi pod pytaniami:
   - Sprzęt jury: nieznany; plan to demo na MacBooku M4 natywnie (llama.cpp z Metal) z zapasowym boxem RunPod A5000; 11B tylko z GPU.
   - Pliki .doc: Tika wystarcza (Apache-2.0); LibreOffice tylko po zgodzie mentora; uwaga, plik .DOC organizatora to w środku DOCX i jest obsłużony.
   - Pisownia kontraktu: trzymamy się goldenów, czyli repeatingSectionGrid oraz MAIN i FINISH wielkimi literami; schemat organizatora ma literówkę.
   - Oficjalne obrazy: używamy oficjalnego apache/tika:3.3.0.0, nie własnego obrazu.
   - Python czy Java: Python 3.14, decyzja zamknięta, cały pipeline już działa.

5. Diagram przepływu COI (dolna ramka). Zaktualizuj węzły tak, aby ścieżka wyglądała następująco: Upload (web lub REST) → walidacja (JWT, nazwa, rozszerzenie, rozmiar, MIME przez magika) → katalog tymczasowy per żądanie → parser według formatu (pdfplumber, python-docx, openpyxl, ODS, Tesseract, Tika/awaryjny .doc) → model dokumentu (nagłówki, kratki, pola ____, tabele, strony) → rozpoznanie kto wnioskuje (deterministyczne) → ekstraktor LLM (llama.cpp, Qwen3.5-4B, gramatyka JSON) z gałęzią „awaria lub timeout → ekstraktor heurystyczny” → grounding i deduplikacja → IR FormSpec → kompilator (szablony stron, adresy, JSONata, grid, flow) → walidator (pydantic, reguły COI, lint JSONata) → JSON COI plus nagłówki X-Extractor i X-Processing-Time-Ms → GUI (upload, JSON, renderer e-usługi z jsonata). Dodaj przy węźle LLM notatkę „zmierzone: 12 tok/s na M4, 65–130 s na formularz 1–2 strony”.

6. Dodaj w ramce COI nową małą kartę „Wyniki pomiarów” z treścią: „Golden 05 nadpłata: composite 0,96, F1 0,92, SHOW 0,97. Golden 01 numer porządkowy: composite 0,93, F1 0,87. Batch 7 formularzy do oceny: 02, 04, 06, 07 poprawne i sensowne; 03, 08, 09 w ponownym przebiegu po poprawkach. Unlimited-OCR na M4 Metal: 30 s/strona, dobry układ i kratki, słabszy polski na gęstym tekście niż Tesseract; na CPU Legion 126 s/strona.”
