---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: implementacja
---

# Formularz 09: lista dyscyplin sportowych

## Problem

Wynik dla formularza 09 nie miał pola z listą dyscyplin. Parser przekazuje pełny wykaz (chunk `strony 1-5`, 4059 znaków). Na stronie 3 są: 3 rodzaje dyscyplin, 20 dyscyplin w kratkach oraz pole tekstowe „Inna dyscyplina ____”.

## Przyczyna

Surowa odpowiedź modelu (`LlmChunk`) dla chunku `strony 1-5` miała tylko sekcję „Rodzaje wniosków”: 109 tokenów, `finish=stop`. Dwa wywołania dały ten sam wynik. Model pominął całe strony 2-3. Reguła POMIŃ („dane wnioskodawcy: imię, nazwisko, adres...”) działała na całą sekcję „Dane sportowca” razem z listą kratek. To nie był limit tokenów ani odrzucenie przez `to_spec`.

## Zmiana

Zmieniony jest tylko `src/formgen/extract/prompts.py` (`SECTIONS_USER`). W promptcie nie ma nazw sportów ani numeru formularza.

- POMIŃ dotyczy samych pól, nie całych sekcji. Model ma przejrzeć cały fragment.
- Lista kratek pod jednym nagłówkiem to jedno pole ze wszystkimi pozycjami. Model nie łączy list. Polecenie w liczbie mnogiej oznacza CHECKBOX. „Inny ____” to osobne TEXT_FIELD.
- RADIO dotyczy wariantów wykluczających się. SELECT oznacza jedną opcję z listy.
- Dodany jest neutralny przykład (języki obce) z dwiema listami CHECKBOX i polem tekstowym.

## Kontrola

`scripts/check_09_dyscypliny.py` uruchamia pełny pipeline na PDF formularza 09 z rzeczywistym modelem. Opcja `--json` sprawdza zapisany wynik. Listę dyscyplin skrypt czyta z tekstu źródła. Wynik FAIL daje:

- brak CHECKBOX z dokładnie tymi 20 opcjami,
- więcej niż jedno pole z listą,
- brak pola „Inna dyscyplina”,
- błąd ERROR w regułach.

```
LLM_BASE_URL=http://100.111.226.49:18081 .venv/bin/python scripts/check_09_dyscypliny.py [--out wynik.json]
.venv/bin/python scripts/check_09_dyscypliny.py --json data/output/09_stypendium_sportowe.json
```

## Wyniki (Qwen3.5-4B-Q4_K_M, llama.cpp GPU, 2026-11-21)

| Wariant | Formularz 09 | Golden 05 composite |
|---|---|---|
| prompt a8a87ea | FAIL: 0 pól z listą, brak „Inna dyscyplina” | 0.92 |
| nowy prompt, przebieg 1 | PASS | 0.92, bez ERROR |
| nowy prompt, przebieg 2 | PASS | 0.92, bez ERROR |

## Ograniczenia

- Dłuższa odpowiedź przekracza `max_tokens=2048` dla chunków `strony 1-5`, `6-9` i `10-13` (`finish=length`). Istniejący podział chunku na połowy odzyskuje wynik, ale przebieg 09 trwa około 6 minut.
- Pole rodzajów dyscyplin („zespołowa / indywidualna – inna / indywidualna – lekkoatletyka”) bywa RADIO, choć polecenie jest w liczbie mnogiej.
- Wynik modelu różni się między przebiegami. Wcześniejsza wersja promptu dała raz RADIO, a raz połączone listy.
