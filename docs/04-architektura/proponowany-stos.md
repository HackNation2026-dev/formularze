---
wersja: 0.3.0
aktualizacja: 2026-11-22
status: PROPONOWANY — nie jest decyzją zespołu
---

# Proponowany stos COI — Cyfryzacja Formularzy

> **Stan faktyczny (2026-11-22):** aplikacja istnieje; co z tej propozycji wdrożono, a co nie (brak React, brak Tiki jako czytnika wszystkich formatów, model Qwen3.5-4B zamiast Bielika, brak kontenera `web`), opisuje [08-implementacja/architektura.md](../08-implementacja/architektura.md).
>
> **Status: PROPONOWANY.** To propozycja do akceptacji przez zespół, nie decyzja ani opis gotowej aplikacji. Opiera się na [konsultacji Fable](../07-decyzje/konsultacja-fable.md) (`claude-fable-5-2`). Wartości RAM i czasu są szacunkami. Licencje oznaczone jako niesprawdzone wymagają weryfikacji. Decyzję zapisuje nowy ADR. [ADR-001](../07-decyzje/ADR-001-stos.md) pozostaje propozycją.

## Wymagania, które stos musi spełnić (organizator)

REST API przyjmujące PDF, DOC, DOCX, ODS, XLSX, JPG, JPEG i PNG; wynik to JSON konfiguracji formularza COI (title/tabs/flow, sekcje, pola, walidacje, JSONata, słowniki). Preferowane Java 21+ lub Python 3.14+. Brak zależności od zewnętrznych API, MCP i SaaS. Open source bez copyleft, bez licencji komercyjnych. Pliki użytkownika tylko tymczasowo. Docker z oficjalnymi obrazami, jawnymi wersjami i użytkownikiem bez roota. GUI i podgląd e-usługi są dodatkowo punktowane. Źródła: [wymagania](../03-wymagania/README.md), [punktacja](../01-zadanie/punktacja.md).

## Proponowany stos

| Warstwa | Propozycja | Status sprawdzenia |
|---|---|---|
| API i logika | Python 3.14 + FastAPI, jeden serwis; walidacja MIME po zawartości, nazwy i rozmiaru; JWT z możliwością wyłączenia | Python 3.14 preferowany przez organizatora |
| Odczyt 8 formatów | Apache Tika jako lokalny kontener (bez sieci) z Tesseractem `pol` do OCR obrazów i skanów | obsługa `.doc` i ODS przez Tikę oraz licencja tessdata do sprawdzenia |
| Generacja | LLM zwraca zwarty model pośredni (strony → sekcje → pola); kompilator w kodzie buduje JSON COI: UUID-y, `techName`, siatka `x/y/rows/cols`, `flow`, strona `FINISH`, JSONata z szablonów | propozycja; kluczowa decyzja |
| Walidacja | własny walidator semantyczny (schemat organizatora nie ma `required`) + kontrola składni JSONata (`jsonata-python`, Apache-2.0) | propozycja |
| Model | lokalny GGUF w llama.cpp (MIT) z gramatyką/schematem; Bielik 4.5B Q4/Q5 (ok. 3–4 GB RAM, szacunek), opcja 11B; tryb heurystyczny bez LLM jako zabezpieczenie | sprzęt COI nieznany; „Terms of Use” GGUF do przeczytania |
| GUI | React/TypeScript: upload, źródło obok JSON, renderer e-usługi z siatką CSS i JSONatą (`jsonata` JS) na żywo | propozycja; punktowane |
| Docker | Compose: `api` (`python:3.14-slim` z digestem), `tika` (`eclipse-temurin:21-jre` + Tika + Tesseract), `llm` (llama.cpp), `web` (nginx); `USER` bez roota, `read_only`, `tmpfs` na `/tmp`, jeden port publiczny, test z siecią `internal` | interpretacja „oficjalnych obrazów” do potwierdzenia |
| Odrzucone | PyMuPDF (AGPL), antiword (GPL); LibreOffice (MPL-2.0) tylko po zgodzie mentora | licencje PyMuPDF i LibreOffice sprawdzone przez Fable |
| Alternatywa | Java 21 + Spring Boot z wbudowaną Tiką, jeśli zespół zna Javę | propozycja |
| Rust | brak w rdzeniu: poza listą preferowaną, dodatkowa granica serwisów bez zysku | rekomendacja Fable |

## Proponowana kolejność

1. Kompilator modelu pośredniego do JSON COI i walidator semantyczny, sprawdzone na dwóch referencjach.
2. Szkielet REST: walidacja pliku, katalog tymczasowy, JWT, Docker bez roota.
3. Adaptery ośmiu formatów na dziewięciu formularzach.
4. Ekstraktor heurystyczny bez LLM.
5. Kontener LLM z gramatyką.
6. Słowniki, dane inicjalne i walidatory (PESEL, NIP, REGON, EMAIL, ZIP_CODE).
7. Zależności i JSONata.
8. Upload i podgląd JSON, potem renderer e-usługi.
9. Test bez sieci, wynikowe JSON-y, README, architektura, slajdy, film.

## Otwarte przed decyzją

Pisownia `repeatingSectionGrid` i nazwy słowników (C-Q01–03); sprzęt na obronie (C-Q07); dopuszczalność MPL; obsługa `.JPE` (C-Q08).
