---
wersja: robocza
aktualizacja: 2026-11-21
status: NOTATKA — ustalenie użytkownika, do rozwinięcia przez osobę odpowiedzialną za COI
---

# Rozpoznawanie typu pliku: Magika

Ustalenie użytkownika (2026-11-21, rozmowa z asystentem):

- Typ pliku przychodzącego do API określa **Magika** (Google): https://github.com/google/magika — po zawartości, nie po rozszerzeniu ani nagłówku `Content-Type`.
- **Odrzucenie musi być czytelne:** odpowiedź mówi, co się stało (np. wykryty typ, rozmiar, nazwa) i dlaczego plik odrzucono (który warunek nie został spełniony).
- **Stabilność:** żaden plik wejściowy (uszkodzony, nietypowy, złośliwy, zbyt duży) nie może wywrócić aplikacji. Błąd wejścia kończy się kontrolowaną odpowiedzią, nie awarią procesu.

Do zrobienia później (inna osoba prowadzi COI): licencja i wersja Magiki, mapowanie etykiet Magiki na 8 akceptowanych formatów (C-Q08: `.JPE`), format odpowiedzi błędu, testy plików granicznych. Powiązane wymagania: COI-07, COI-08, COI-09 w [wymaganiach](../03-wymagania/README.md).

Uwaga z recenzji Codex (2026-11-21) do tego samego obszaru: limity stron, pikseli, rozpakowanych danych, pamięci i współbieżności oraz sprzątanie plików także po timeoutach i przerwaniu klienta.
