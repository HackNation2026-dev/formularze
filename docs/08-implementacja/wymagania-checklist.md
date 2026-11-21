---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Cyfryzacja formularzy (COI) – checklista wymagań

Źródło: `docs/zadanie.txt` (pełna treść zadania, HackNation 2026). Nagroda: 25 000 zł (1 nagroda).

## Cel
Usługa AI: plik formularza (PDF/DOC/DOCX/ODS/XLSX/JPG/JPEG/PNG) -> JSON ze strukturą formularza
elektronicznego, zgodny ze schematem oczekiwanym przez aplikację COI (Generator Formularzy / AI HUB / Multiportal).
Użytkownik docelowy: urzędnik cyfryzujący formularze e-usług.

## Zakres minimalny (obowiązkowy)
- [ ] REST API: upload pojedynczego pliku formularza -> JSON
- [ ] JSON odpowiada zawartości formularza (dane z pkt 3.1.II)
- [ ] JSON zgodny ze strukturą oczekiwaną przez aplikację (wzór: pliki JSON z pkt 3.1.I)
- [ ] JSON spełnia wymagania projektowania formularzy (np. podział na strony tematyczne – pkt 3.1.III)
- [ ] Dokumentacja architektury rozwiązania

## Rozszerzenia (dodatkowo punktowane – kolejność z kryteriów oceny)
- [ ] I. Powiązanie pól ze słownikami i danymi inicjalnymi z bazy wejściowej
- [ ] II. Propozycja nowego słownika, gdy brak pasującego
- [ ] III. Zależności / dynamiczne przepływy między polami, sekcjami, stronami (warunki widoczności)
- [ ] IV. Prosty frontend: upload plików + podgląd JSON
- [ ] V. Aplikacja wizualizująca JSON jako formularz eUsługi (render)
- [ ] VI. Walidacje pól (typ, długość, PESEL, telefon, …), UX (batch, makiety)

## Wymagania techniczne (twarde)
- [ ] Język: Python >= 3.14 (mamy `/opt/homebrew/bin/python3.14`, 3.14.4) lub Java >= 21
- [ ] Tylko open source, BEZ copyleft (AGPL, GPL zakazane). Uwaga na: PyMuPDF (AGPL), Ghostscript (AGPL), unoconv (GPL), odfpy (GPL/Apache dual – OK pod Apache)
- [ ] BEZ zewnętrznych API / MCP / SaaS w runtime. BEZ LLM dostępnych tylko przez API (OpenAI/Anthropic/Gemini). Modele lokalne OK. LLM wolno używać do pisania kodu.
- [ ] Brak licencji komercyjnych
- [ ] REST API: upload pojedynczego pliku (blankiet formularza)
- [ ] Formaty: .pdf .doc .docx .ods .xlsx .jpg .jpeg .png
- [ ] Walidacja MIME (zawartość == rozszerzenie)
- [ ] Walidacja nazwy pliku: <= 250 znaków, zakazane znaki: `; : > < / \ | ' * % $`
- [ ] Max rozmiar pliku konfigurowalny (parametr aplikacji / env)
- [ ] Plik przetwarzany tylko w RAM lub tmp na czas żądania – brak trwałego storage
- [ ] Docker: oficjalne obrazy bazowe, lekkie (Alpine), jawne wersje, bez `latest`, dedykowany user bez roota, tylko wymagane porty, sekrety przez env w runtime
- [ ] Konfiguracja: max rozmiar pliku, parametry JWT, parametry integracyjne
- [ ] README.md: build Docker, uruchomienie, konfiguracja, opis REST API

## Wymagania formalne (zgłoszenie)
- [ ] Tytuł + szczegółowy opis projektu
- [ ] Prezentacja PDF (max 10 slajdów)
- [ ] Wynikowe pliki JSON dla formularzy z pkt 3.1.II
- [ ] Film max 3 min w otwartym repo (link)
- [ ] Repozytorium kodu
- opcjonalnie: screeny, link do demo, grafiki

## Testowanie przez jury
Finaliści uruchamiają rozwiązanie na NOWYCH plikach podczas obrony. Rozwiązanie musi działać offline, na żywo, na dowolnym formularzu.

## Kryteria oceny
| Kryterium | Waga |
|---|---|
| Kompletność (minimum + rozszerzenia I–V) | 30% |
| Intuicyjność | 20% |
| Jakość kodu | 20% |
| Potencjał wdrożeniowy (w tym koszt) | 20% |
| Oryginalność | 10% |

## Materiały od organizatora (Discord: kanał `Cyfryzacja formularzy/materiały-dodatkowe`)
1. Przykładowe formularze (różne formaty) + odpowiadające JSON-y + screeny eUsługi -> `data/input/01..03`
2. Formularze do oceny (bez JSON) -> `data/input/04_formularze_do_oceny`
3. Wymagania projektowania formularzy + założenia techniczne konfiguracji -> `data/input/05_wymagania_projektowanie`
4. Opis słowników i danych inicjalnych -> `data/input/06_slowniki`
5. Tokeny (dla pierwszych 20 zespołów) – prawdopodobnie do LLM na etapie dev; w runtime i tak zakaz API
