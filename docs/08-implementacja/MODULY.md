---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: implementacja
---

# Moduły i ich niezależne ulepszanie

Każdy moduł ma jedno wejście i jedno wyjście. Moduł wolno ulepszać osobno, jeśli jego kontrakt się nie zmienia i jego
miara nie spada. Kierunek importów pilnuje `lint-imports` w CI (kontrakt w `pyproject.toml`):

```
api  >  pipeline  >  extract  >  compose | ingest  >  schema  >  config
eval  ->  schema (tylko)
```

Moduł może importować tylko warstwy pod sobą. `compose` i `ingest` nie importują się nawzajem.

## Mapa

| Moduł | Wejście -> wyjście | Pliki | Miara i test | Znane słabości (kolejne kroki) |
|---|---|---|---|---|
| `ingest` | bajty pliku -> `Document` (strony, linie, `____`, `☐`, tabele) | `src/formgen/ingest/` | `tests/unit/test_ingest.py`; w `eval_suite.py` składowa pokrycia (c) per format | XLSX/ODS: opcje bez kratek `☐` (03); OCR PNG gubi pola wykropkowane (04, 06); strona arkusza bez podziału (08: 16 tys. znaków) |
| `extract` | `Document` -> `FormSpec` (tylko przedmiot wniosku) | `src/formgen/extract/` (`prompts.py`, `extractor.py`, `heuristic.py`, `llm_client.py`) | `scripts/eval_suite.py` (SCORE); zmiana w `to_spec`: `make eval-warm` z cache; zmiana promptu: dwie próbki modelu | odpowiedź modelu ucina się przy `max_tokens=2048` (06, 08, 09); różne pola dla formatów tego samego formularza; szum LLM ±0,017 |
| `compose` | `FormSpec` -> `FormDefinition` (szablon COI: Dane, kontakt, zgody, strona końcowa) | `src/formgen/compose/` | `tests/unit/test_compose.py`, `tests/unit/test_golden.py` (composite vs JSON-y COI) | deterministyczny; zmiany tylko pod nowe reguły COI lub odpowiedzi mentorów |
| `schema` | `FormDefinition` -> lista naruszeń reguł; walidatory wartości | `src/formgen/schema/` | `tests/unit/test_validators.py`, `test_golden.py` (wzorce przechodzą bez błędów) | reguły z dokumentu COI; nie zmieniać bez źródła w materiałach |
| `pipeline` | bajty -> `PipelineResult` (spina ingest, extract, compose, check_rules; fallback heurystyczny) | `src/formgen/pipeline.py` | `tests/api/test_analyze.py` | cienka warstwa, bez logiki domenowej |
| `api` | HTTP -> JSON (upload, JWT, błędy, limity) | `src/formgen/api/` | `tests/api/test_analyze.py`, `scripts/verify_stack.sh` (15 kontroli Dockera i API) | stabilne; zmiany tylko pod wymagania R-xx |
| `config` | zmienne środowiskowe -> `Settings` | `src/formgen/config.py` | importowany przez wszystkie warstwy, sam nie importuje nic z `formgen` | każdą nową zmienną dopisz do tabeli w README |
| `eval` | `FormDefinition` + wzorzec -> metryki | `src/formgen/eval/`, `scripts/eval_suite.py`, `scripts/eval_fast.sh` | `tests/unit/test_metric.py`; czułość: `eval_suite.py --sabotage` musi obniżyć SCORE | metryka pokrycia nagradza nadmiar pól; patrz też na liczbę pól |
| UI `/review/` | JSON + PDF -> podgląd, symulacja, poprawki, eksport | `src/formgen/static/review/` | `npm run check:ui && npm run test:ui` (Playwright) | podgląd źródła tylko dla PDF |

## Zasady pracy nad modułem

1. Gałąź od świeżego `develop`, jeden moduł na PR.
2. Przed zmianą zapisz miarę modułu (kolumna „Miara i test”). Po zmianie ta sama miara nie może spaść.
3. `make test`, `ruff check`, `lint-imports` zielone przed PR. CI sprawdza to samo.
4. Zmiana kontraktu (typów `Document`, `FormSpec`, `FormDefinition`) wymaga zgody właścicieli modułów po obu stronach.
5. Do `main` tylko przez release PR po `scripts/verify_stack.sh` na x86.

Kontrakty między modułami: `Document` w `src/formgen/ingest/model.py`, `FormSpec` w `src/formgen/compose/spec.py`,
`FormDefinition` w `src/formgen/schema/model.py`.
