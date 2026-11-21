---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: dokumentacja przygotowawcza
---

# Wymagania COI

Status wszystkich pozycji: do implementacji lub weryfikacji.

| ID | Wymaganie | Kryterium odbioru |
|---|---|---|
| COI-01 | REST API przyjmujące pojedynczy blankiet | odpowiedź z konfiguracją JSON |
| COI-02 | PDF, DOC/DOCX, ODS, XLSX, JPG/JPEG, PNG | działający adapter każdego formatu |
| COI-03 | Kontrakt COI i reguły projektowania | walidacja struktury oraz reguł biznesowych |
| COI-04 | Brak zależności od zewnętrznych API/MCP/SaaS w aplikacji | pełne przetwarzanie bez Internetu |
| COI-05 | Brak LLM dostępnego wyłącznie przez API | lokalny model lub inne lokalne metody |
| COI-06 | Komponenty open source bez wskazanego copyleft | spis wersji i warunków licencyjnych |
| COI-07 | Weryfikacja MIME, nazwy i rozmiaru | odrzucenie niewłaściwego pliku |
| COI-08 | Nazwa do 250 znaków; zakazane znaki według opisu | testy graniczne nazwy |
| COI-09 | Rozmiar pliku konfigurowalny | limit egzekwowany |
| COI-10 | Wyłącznie tymczasowe przechowywanie pliku użytkownika | usunięcie po żądaniu także przy błędzie |
| COI-11 | Docker, jawne wersje, bez latest, ograniczony użytkownik | start według README |
| COI-12 | Konfiguracja m.in. limitu oraz parametrów JWT | udokumentowane ustawienia |
| COI-13 | Dokumentacja budowy, startu, konfiguracji i REST | samodzielne uruchomienie przez jury |
| COI-14 | Słowniki / dane inicjalne / nowe słowniki | rozszerzenia ocenione osobno |
| COI-15 | Zależności, GUI, podgląd i walidacje | rozszerzenia ocenione osobno |

Preferowane języki: Java 21+ albo Python 3.14+. Rust nie jest wskazany jako preferowany. [Kontrakt danych](kontrakt-danych.md) wyjaśnia reguły z paczki.

Oryginały materiałów w Git są zestawem konkursowym. COI-10 dotyczy plików przesyłanych przez użytkownika do działającej aplikacji, nie zakazuje wersjonowania otrzymanych materiałów konkursowych.
