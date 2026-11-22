---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: szkic do prezentacji
---

# Scenariusze prezentacji (do wyboru i iteracji)

Ramy formalne i punktacja pochodzą z [README](README.md), [SLAJDY-I-FILM](SLAJDY-I-FILM.md)
oraz [punktacji](../01-zadanie/punktacja.md). Ten dokument to wersje do dyskusji; nie zastępuje
SLAJDY-I-FILM, dopóki nie wybierzemy jednej.

## Ramy formalne

- Prezentacja: **PDF, maks. 10 slajdów**. Nie PowerPunkt — projektujemy slajdy i eksportujemy do PDF.
- Film: **maks. 3 minuty**, nagrany na stacku z `docs/08-implementacja/DEMO-SETUP.md`.
- Zgłoszenie: opis i tytuł, PDF do 10 slajdów, wynikowe JSON-y, film, kod i README (budowa obrazu,
  start, konfiguracja, opis REST). Repo publiczne.
- Na slajdach pokazujemy osobno: zakres **działający**, zakres **dodatkowy**, **ograniczenia**.
- Obrona: jury wręcza finalistom **nowy formularz** — prezentacja musi pokazać ogólność pipeline'u,
  nie dopasowanie do przykładów.

## Jak ocenia jury i co z tego wynika dla slajdów

| Kryterium | Waga | Co ma być widoczne na slajdach |
|---|---|---|
| Kompletność i progi rozszerzeń | 30% | wprost: co działa, co rozszerzone (słowniki, walidacje, GUI, podgląd) |
| Intuicyjność | 20% | obrazy działającej aplikacji, nie diagramy abstrakcji; krok po kroku jak dla urzędnika |
| Oryginalność | 10% | mocny otwierający obraz/puenta; zasada „model tylko tam, gdzie reguły nie wystarczą" |
| Jakość kodu | 20% | `verify_stack.sh` 15/15, `eval_suite.py`, walidator reguł — dowody, nie deklaracje |
| Potencjał wdrożeniowy i koszt | 20% | liczby: tok/s CPU vs GPU, brak zewnętrznych API, Docker, koszt serwera |

## Scenariusz A — „Rzetelność" (klasyczny jury-tech)

Bazuje na SLAJDY-I-FILM.md. Każdy slajd = jedna teza + jeden dowód.

1. Problem: papierowy blankiet → ręczna konfiguracja to godziny; my: plik → JSON konfiguracji.
2. Użytkownik: urzędnik wrzuca, przegląda obok źródła, poprawia, eksportuje; obywatel dostaje e-usługę.
3. Przepływ: parser → model dokumentu → lokalny LLM (tylko przedmiot wniosku) → kompilator szablonów
   COI → walidator. Diagram z docs/04-architektura.
4. Dlaczego tak: reguły robią stałą strukturę, model tylko treść; wynik zawsze zgodny z regułami COI.
5. Kontrakt COI: schemat, słowniki, JSONata, walidatory PESEL/NIP/REGON; 3 nowe słowniki.
6. Bezpieczeństwo i wdrożenie: Docker, bez roota, sieć modelu bez Internetu, JWT; 15/15.
7. Otwarty model bez zewnętrznych API: Qwen3.5-4B (Apache-2.0), ~11 tok/s CPU vs ~59 GPU; tryb
   heurystyczny przy awarii.
8. Jakość zmierzona: composite 0,92 na formularzach wzorcowych; eval 9 formularzy w 4 formatach.
9. `/review/`: źródło obok pól, symulacja e-usługi, poprawki, wsad wielu plików, eksport.
10. Ograniczenia i dalszy rozwój.

Zaleta: najbezpieczniejsza, trudno jej zarzucić lukę. Wada: mało emocji, oryginalność 10% ledwo ruszona.

## Scenariusz B — „Historia urzędnika" (storytelling)

Ta sama treść, inna oś narracji: jeden dzień pracy urzędnika. Slajdy jak kadry opowieści.

1. Pani z urzędu przed sobą ma 300 stron wniosków w 4 formatach (obraz: stos papierów).
2. Dziś: ręczne przepisywanie do Generatora Formularzy COI — godziny na jeden wniosek.
3. „A gdyby wrzucić plik?" — import blankietu do `/review/` (zrzut ekranu).
4. 90 sekund później: lista pól obok źródła, strona „Dane" i zgody z szablonu COI.
5. Jak to działa pod spodem: pipeline (krótki diagram, głównie wizualnie).
6. Dlaczego wynik jest zawsze poprawny: kompilator + walidator reguł COI; model nie „wymyśla" JSON-a.
7. Bezpiecznie i bez Internetu: Docker, JWT, lokalny Qwen3.5-4B; 15/15.
8. Wiemy, ile to jest warte: 0,92 zgodności, eval 9 formularzy, koszt CPU/GPU.
9. Wróć do pani urzędniczki: poprawia etykietę, eksportuje JSON, obywatel składa online.
10. Czego jeszcze nie umiemy i co jest w planie.

Zaleta: intuicyjność + oryginalność; żyje w pamięci jury. Wada: łatwiej zgubić dowody — trzeba je
wpleść w kadry (slajdy 6–8).

## Scenariusz C — „Demo napędza" (slajdy jako rama dla show)

Slajdy maksymalnie proste, storia prowadzi live demo lub screencast wstawiony w slajdy.

1. Jedno zdanie problemu + zdjęcie papierowego blankietu.
2. Pełnoekranowy zrzut: `/review/` przed importem — „puste miejsce pracy urzędnika".
3. Pełnoekranowy zrzut: ten sam ekran po imporcie — przepływ opisany numerami na zrzucie.
4. Symulacja e-usługi: warunek JSONata na żywo (sekcja pełnomocnictwa).
5. Walidacja: błędny PESEL odrzucony, słownik krajów w liście rozwijanej.
6. Ekran terminala: `verify_stack.sh` 15/15 — jedyny slajd „techniczny" pełnoekranowy.
7. Diagram pipeline'u w jednej linii: parser → model dokumentu → LLM → kompilator → walidator.
8. Liczby na tablicy: 0,92 · 15/15 · ~11 vs ~59 tok/s · 0 zewnętrznych API.
9. Kontrakt COI i rozszerzenia: trzy kolumny (działa / dodatkowe / ograniczenia).
10. Puenta: „od papieru do e-usługi jednym wsadem" + co dalej.

Zaleta: maks. intuicyjności, gra żywym demem na obronie (nowy formularz! — można pokazać pipeline
na żywo). Wada: duże ryzyko, jeśli demo padnie; slajdy same w sobie nie dają pełnej treści.

## Scenariusz D — „Decydent" (wdrożenie i koszt najpierw)

Najpierw odpowiedź na „czy to się uruchomi i ile kosztuje", potem technika.

1. Puenta na wstępie: pełna e-usługa z blankietu, bez chmury, bez licencji copyleft.
2. Koszt: otwartoźródłowy model na CPU (~11 tok/s) albo jeden serwer z GPU (~59 tok/s); brak API.
3. Bezpieczeństwo: Docker, bez roota, RO filesystem, sieć modelu bez Internetu, JWT, przypięte wersje.
4. Dowód: `verify_stack.sh` 15/15; każdy wynik przechodzi reguły COI (walidator).
5. Zgodność: kontrakt COI, słowniki, JSONata, PESEL/NIP/REGON; 3 nowe słowniki jako rozszerzenie.
6. Jak to się ma do jury przekazanego nowego formularza: pipeline ogólny, eval 9 formularzy w 4 formatach.
7. Przepływ (jeden obraz) + `/review/` dla urzędnika.
8. Jakość zmierzona: composite 0,92, miara reaguje na zepsuty prompt.
9. Ograniczenia: skany słabej jakości, długie tabele, różnice między formatami.
10. Dalszy rozwój i harmonogram.

Zaleta: celuje w 20% „potencjał wdrożeniowy i koszt" na pierwszych slajdach. Wada: technika i
historia urzędnika schodzą na dalszy plan — intuicyjność cierpi, jeśli jury nie jest decydentami.

## Rekomendacja

Hybryda **A + B**: struktura i dowody z A, otwarcie i zamknięcie z B (kadry urzędnika na slajdach 1–2
i 9). Oryginalność i intuicyjność rosną bez utraty rzetelności. Rozpisane powyżej warianty zostają
jako leware do iteracji po feedbacku.

## Szko projektowania slajdów

- 16:9 (np. 1280×720), max 10 sztuk, eksport do PDF.
- Jedna myśl na slajd; liczby dużym drukiem; żadnych pełnych akapitów.
- Zrzuty ekranu `/review/` i symulacji z DEMO-SETUP — na slajdach 2–3 i 9.
- Diagram pipeline'u jednolinijkowy, w stylu z docs/04-architektura.
- Zawsze oznacz: działa / dodatkowe / ograniczenia.
- Przed publikacją: sprawdzić liczby z README („Pomiary") i `scripts/verify_stack.sh`.
