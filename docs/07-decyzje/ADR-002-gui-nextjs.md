---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: przyjęta przez użytkownika 2026-11-22; etap 1 wdrożony (patrz GUI-DO-ZROBIENIA.md)
---

# ADR-002 — GUI jako aplikacja Next.js / React / TypeScript / TanStack

## Kontekst

`docs/08-implementacja/FRONTEND-BRIEF.md` zakładał statyczny HTML/JS/CSS bez build stepu, serwowany przez FastAPI. `docs/04-architektura/pelna-aplikacja.md` proponował React + TypeScript. Użytkownik zdecydował 2026-11-22: duża aplikacja React, Next.js, TypeScript, TanStack. Interfejs `/review/` z `src/formgen/static/review/` (przegląd PDF obok pól) zostaje bez zmian.

## Decyzja

Nowa aplikacja w `apps/web/`: Next.js (App Router), React, TypeScript strict, Tailwind CSS v4 z tokenami z `design/tokens.css`, TanStack Query (dane z API), TanStack Table (kolejka, listy walidacji), TanStack Form (formularze), next-intl (PL/EN), jsonata (warunki podglądu e-usługi). Testy: Vitest + Testing Library, Playwright. Na tym etapie aplikacja działa na warstwie mock API (MSW) zgodnej z kontraktem `src/formgen/api/`; przełączenie na prawdziwe API to zmiana zmiennej środowiskowej.

## Konsekwencje

- Dodatkowy łańcuch narzędzi (Node, npm, lockfile) obok Pythona; Docker i CI wymagają osobnego etapu dla `apps/web/`.
- Aplikacja działa offline w runtime: brak CDN, czcionki dołączone lokalnie (wymaganie COI-04).
- Wersje zależności przypięte (`--save-exact`, `package-lock.json`); licencje spisane w `docs/08-implementacja/LICENSES-WEB.md` (wymaganie COI-06, bez copyleft).
- Static `/review/` i `apps/web/` współistnieją; wspólny jest tylko kontrakt API. Integracja z Dockerem i compose jest poza tym etapem.
- Tokeny: jedno źródło `design/tokens.css`; kopia w `apps/web` jest generowana i testowana pod kątem zgodności.
- Ryzyko: Next.js wymaga serwera Node (lub eksportu statycznego) do produkcji; wybór sposobu serwowania odłożony do etapu integracji.
