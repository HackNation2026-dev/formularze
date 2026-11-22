---
wersja: 0.4.0
aktualizacja: 2026-11-22
status: indeks; propozycje historyczne + wskaźnik na stan faktyczny
---

# Architektura COI

## Stan faktyczny (kod na `develop`)

Autorytatywny opis działającej aplikacji, ze schematem potoku i ścieżkami modułów przy każdym pudełku:
[docs/08-implementacja/architektura.md](../08-implementacja/architektura.md). Podział na moduły, ich kontrakty i
miary: [MODULY.md](../08-implementacja/MODULY.md). Kontrakt REST i konfiguracja: `README.md` (sekcje „Konfiguracja”
i „REST API”) oraz [SPEC.md](../08-implementacja/SPEC.md).

Interfejsy: `/review/` (serwowany przez API, w obrazie Docker) oraz osobna aplikacja GUI `apps/web`
(Next.js, [ADR-002](../07-decyzje/ADR-002-gui-nextjs.md)), która woła to samo REST API i nie wchodzi do obrazu Docker backendu.

W skrócie, co istnieje: jeden serwis Python 3.14 / FastAPI (`src/formgen/`) z potokiem
`ingest -> extract (LLM przez llama.cpp z gramatyką JSON, fallback heurystyczny) -> compose (deterministyczny
szablon COI) -> schema (reguły techniczne)`, kontenery `api`, `llm`, `tika` w `compose.yaml`, interfejs przeglądu
`/review/` w czystych modułach ES serwowanych przez API. W obrazie Docker backendu nie ma frontendu React/TypeScript;
osobne GUI `apps/web` (Next.js) działa jako odrębny proces. Nie ma Rusta, bazy ani kolejki.

## Propozycje sprzed implementacji (historyczne, 2026-11-21)

Poniższa tabela i pliki w tym katalogu zapisują stan rozważań przed napisaniem kodu. Zostawiamy je jako ślad
decyzji; nie opisują aplikacji.

```text
(propozycja) GUI TypeScript -> REST API -> adapter wejścia -> analiza dokumentu
              -> wewnętrzny model formularza -> mapowanie COI
              -> walidacja struktury i reguł -> JSON + podgląd e-usługi
```

| Warstwa | Propozycja (21.11) | Co zrealizowano |
|---|---|---|
| API | Rust/Axum albo Python/FastAPI | Python/FastAPI (`src/formgen/api/`) |
| Analiza i adaptery | Python 3.14+ | tak (`src/formgen/ingest/`, `extract/`) |
| Model | lokalny, po pomiarze | Qwen3.5-4B GGUF w llama.cpp; dopuszczony ten sam otwarty model w chmurze z lokalnym zapasem |
| GUI | TypeScript | `/review/`: HTML + moduły ES bez frameworka (`src/formgen/static/review/`); osobno `apps/web` (Next.js, TypeScript), poza obrazem Docker |
| Dostarczenie | Docker Compose | `compose.yaml`: `api`, `llm`, `tika`; obrazy przypięte, non-root, read-only |

Zasady, które przetrwały: brak bazy i kolejki; plik użytkownika tylko w pamięci na czas żądania; limity i błędy
adapterów jawne (`README.md`, kody błędów); zasoby modelu przygotowane przed pokazem (`make models`), bez pobierania
w czasie działania; licencje bez copyleft ([LICENSES.md](../08-implementacja/LICENSES.md)).

- [Pełna aplikacja i wybór interfejsu](pelna-aplikacja.md) — historyczna propozycja React/TypeScript vs egui.
- [Proponowany stos](proponowany-stos.md) — status PROPONOWANY (nie decyzja zespołu), z adnotacją o stanie faktycznym.
