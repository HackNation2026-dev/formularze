---
wersja: 0.1.1
aktualizacja: 2026-11-22
status: ustalenia zespołu i zweryfikowane fakty do prezentacji
---

# Kontekst prezentacji HackNation

## Materiały

- Źródłem prezentacji jest strona **E - Finalny** w [pliku FigCraft](figcraft/szkice-prezentacji.figcraft). Strony A–D zawierają wcześniejsze warianty do wykorzystania podczas pracy.
- [PDF konkursowy](prezentacja-szkic-2026-11-22.pdf) zawiera slajdy 01–10 w kolejności wystąpienia. Każda strona ma rozmiar 1280 × 720. Po zmianie źródła należy wyeksportować stronę E pod tą samą nazwą i sprawdzić polskie znaki w tekście PDF.
- Materiały do wystąpienia uzupełniają [plan slajdów i filmu](SLAJDY-I-FILM.md) oraz [szkice scenariuszy](scenariusze-prezentacji.md).

## Ustalenia zespołu

Jasne tło, granatowe nagłówki, cienkie linie i krój Inter. Kolorowe etykiety rozróżniają działające funkcje, wyniki pomiarów i rozszerzenia. Otwarcie „Od papieru do e-usługi — jednym wsadem” prowadzi do deklaracji o odpadach, architektury, prac nad rozwiązaniem, ewaluacji, przeglądu formularza, kontraktu COI, wdrożenia i żywego demo. Prezentację zamyka zespół. Na okładce i slajdzie zespołowym zarezerwowano miejsce na zdjęcia.

## Pomiary użyte na slajdach

Źródłem wyników jest [README, sekcja „Pomiary”](../../README.md#pomiary-stan-2211) na gałęzi develop. Wyjątek stanowi historyczna seria optymalizacji CPU, udokumentowana w [stanie projektu](../08-implementacja/STAN-PROJEKTU.md).

| Zakres | Wynik i sposób odczytu |
|---|---|
| Wsad GPU z 22.11 | 9/9 formularzy z JSON-em, 0 błędów reguł COI. Przy przetwarzaniu 2 formularzy naraz czas wynosił do 5 min na formularz. To maksimum wsadu. Deklaracja 08 należała do najdłużej przetwarzanych. |
| Formularz 05 na CPU | 207 s → 122 s w serii optymalizacji. Osobny test verify_stack na x86 bez GPU dał 85 s. |
| Wzorce 01 / 05 | Composite 0,925 / 0,919 (na kafelku wartość przybliżona 0,92). Recall 0,96 / 0,93. F1 0,86 / 0,84. F1 samego przedmiotu wniosku 0,75 / 0,50. Kafelek recall pokazuje formularze w kolejności 05 / 01. |
| Test smoke | SCORE po zaokrągleniu 0,75. Przebieg eval-warm z zapisanymi odpowiedziami modelu trwał ok. 20 s. |
| Wdrożenie | 14/14 kontroli Docker i API na x86 bez GPU. Generacja modelu osiągnęła ok. 11 tok/s na CPU i ok. 59 tok/s na GPU. |

Model Qwen3.5-4B odczytuje przedmiot wniosku. Kompilator dodaje stałe części formularza, a walidator sprawdza reguły COI. Sekcji powtarzalnych nie pokazujemy jako wyniku dla ocenianych formularzy. Na slajdzie demo czas analizy na CPU opisujemy jako możliwe ograniczenie. README odnotowuje dla deklaracji 08 pojedynczy pomiar na kodzie z dodatkową zmianą spoza main.

**Usunięty punkt „~25 min” dla formularza 08 na CPU.** Na kodzie z main brak pomiaru potwierdzającego tę wartość. Nie używamy jej przy omawianiu wyników.

## Przed zgłoszeniem

- Uzupełnić zarezerwowane miejsca rzeczywistymi zdjęciami, gdy zespół je wybierze.
- Makietę przeglądu można zastąpić zrzutem z wersji GUI używanej podczas obrony. [Instrukcja uruchomienia](../08-implementacja/DEMO-SETUP.md).
- Sprawdzić film i potwierdzić termin zgłoszenia u organizatora. Podczas pokazu zacząć od blankietu i sprawdzić wygenerowane pola na tym samym przykładzie.
