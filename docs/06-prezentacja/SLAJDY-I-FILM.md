---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: szkic do prezentacji
---

# Slajdy i scenariusz filmu

Treść do przeniesienia do slajdów (max 10) i scenariusz filmu (max 3 min). Liczby pochodzą z README (sekcja „Pomiary”)
i z `scripts/verify_stack.sh`. Przed obroną sprawdź, czy liczby są nadal aktualne.

## Slajdy

1. **Problem.** Urzędy mają setki papierowych wniosków. Ręczna konfiguracja jednego e-formularza w Generatorze COI to
   godziny pracy. Cel: z pliku blankietu (PDF, DOC, DOCX, ODS, XLSX, JPG, PNG) od razu poprawny JSON konfiguracji.
2. **Użytkownik.** Urzędnik wrzuca blankiet, dostaje gotowy formularz, przegląda go obok źródła, poprawia i eksportuje.
   Obywatel dostaje e-usługę zgodną ze standardem projektowania COI.
3. **Przepływ.** Parser formatu -> model dokumentu (nagłówki, pola `____`, kratki, tabele) -> lokalny LLM wyodrębnia
   tylko przedmiot wniosku -> deterministyczny kompilator szablonów COI (strona „Dane”, kontakt, zgody, strona końcowa)
   -> walidator reguł technicznych. Diagram: strona architektury z `docs/04-architektura/`.
4. **Dlaczego tak.** Model robi tylko to, czego nie da się zrobić regułami (zrozumienie treści). Wszystko, co ma
   stałą strukturę, robi kod. Dzięki temu każdy wynik przechodzi reguły COI: pipeline nigdy nie zwraca JSON-a, który je łamie.
5. **Kontrakt COI.** JSON zgodny ze schematem organizatora, słowniki z dokumentu „Słowniki”, warunki widoczności
   w JSONata, walidatory PESEL, NIP, REGON, kod pocztowy, dowód osobisty. Propozycja 3 nowych słowników (dyscypliny
   sportowe, rasy psów, rodzaje podatku).
6. **Bezpieczeństwo i wdrożenie.** Docker, użytkownik bez roota, system plików tylko do odczytu, sieć modelu bez
   Internetu, JWT, przypięte wersje obrazów, brak sekretów w obrazie. `scripts/verify_stack.sh`: 15/15 na x86 bez GPU.
7. **Otwarty model, bez zewnętrznych API.** Qwen3.5-4B (Apache-2.0) w llama.cpp. Ten sam model lokalnie na CPU
   (ok. 11 tok/s) albo na własnym serwerze z GPU (ok. 59 tok/s). Przy awarii modelu tryb heurystyczny: JSON zawsze
   poprawny. Brak licencji copyleft w zależnościach.
8. **Jakość, zmierzona.** Zgodność z JSON-ami wzorcowymi COI: composite 0,92 na obu formularzach przykładowych.
   Harness `scripts/eval_suite.py` mierzy 9 formularzy w 4 formatach: zgodność pól między formatami, pokrycie pól
   do wpisania i szum. Celowo zepsuty prompt obniża wynik, więc miara reaguje na jakość.
9. **Interfejs przeglądu `/review/`.** Źródło obok pól, symulacja e-usługi z warunkami na żywo, poprawka etykiety lub
   typu pola, uwagi, wsad wielu plików, eksport czystego JSON-a.
10. **Ograniczenia i dalszy rozwój.** Skany słabej jakości (OCR gubi pola wykropkowane), długie tabele deklaracji,
    różnice w polach między formatami tego samego formularza. Dalej: OCR na GPU dla skanów, uczenie na poprawkach
    urzędników z `/review/`, katalog szablonów urzędów.

## Film (max 3 min)

| Czas | Ekran | Co mówimy |
|---|---|---|
| 0:00–0:15 | Papierowy wniosek (PDF formularza 05) | Problem: każdy taki wniosek trzeba dziś ręcznie przepisać na e-formularz. |
| 0:15–0:45 | `/review/`, wrzucenie PDF | Wrzucamy blankiet. Usługa działa na naszym serwerze z otwartym modelem. |
| 0:45–1:15 | Wynik: lista pól obok źródła | Pola przedmiotu wniosku z blankietu, strona „Dane” i zgody z szablonu COI. |
| 1:15–1:45 | Symulacja e-usługi: wybór „Innej osoby” | Pojawia się sekcja pełnomocnictwa: warunek JSONata działa na żywo. |
| 1:45–2:05 | Błędny PESEL w symulacji | Walidator odrzuca wartość. Słownik krajów w liście rozwijanej. |
| 2:05–2:25 | Wsad: XLSX i PNG tego samego formularza | Inne formaty dają ten sam formularz. |
| 2:25–2:45 | Terminal: `scripts/verify_stack.sh` | 15/15: bez roota, sieć modelu bez Internetu, JWT, wynik zgodny z regułami COI. |
| 2:45–3:00 | Pobranie JSON | Gotowy plik do importu w Generatorze Formularzy COI. |

Nagrywaj na stacku z `docs/08-implementacja/DEMO-SETUP.md`. Przed nagraniem przejdź scenariusz raz na sucho.
