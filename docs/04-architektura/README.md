---
wersja: 0.3.0
aktualizacja: 2026-11-21
status: dokumentacja przygotowawcza
---

# Architektura COI — propozycja

Stan: propozycja do implementacji.

```text
GUI TypeScript -> REST API -> adapter wejścia -> analiza dokumentu
              -> wewnętrzny model formularza -> mapowanie COI
              -> walidacja struktury i reguł -> JSON + podgląd e-usługi
Model/OCR i wszystkie zasoby potrzebne podczas analizy: lokalne
```

| Warstwa | Propozycja | Warunek |
|---|---|---|
| API | Rust/Axum, jeśli gotowa baza; alternatywnie Python/FastAPI | Rust nie może opóźniać zakresu |
| Analiza i adaptery | Python 3.14+ | formaty i zgodność paczki |
| Model | lokalny, po pomiarze jakości, RAM i czasu | brak usług zewnętrznych |
| GUI | TypeScript | import i wynik obok źródła |
| Dostarczenie | Docker Compose | wersjonowane obrazy, ograniczone uprawnienia |

Nie wymagamy dodatkowej bazy ani kolejki na etapie prototypu. Pliki użytkowników przetwarzaj tylko tymczasowo. Limity i błędy adapterów muszą być jawne. Zasoby modelu przygotuj przed pokazem; działanie aplikacji nie może zależeć od pobierania ich z sieci.

Przed wyborem narzędzi do PDF i konwersji DOC sprawdź licencje komponentów i zależności. Popularność biblioteki nie potwierdza zgodności z wykluczeniem copyleft. Nie wskazano jeszcze zatwierdzonego zestawu bibliotek.

Zobacz [pełną aplikację i wybór interfejsu](pelna-aplikacja.md).

## Proponowany stos

[Proponowany stos](proponowany-stos.md) — status: PROPONOWANY, nie decyzja zespołu. Wersja 0.3.0.
