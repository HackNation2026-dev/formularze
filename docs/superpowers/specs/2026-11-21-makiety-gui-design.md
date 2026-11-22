---
wersja: 0.1.0
aktualizacja: 2026-11-21
status: projekt do akceptacji
---

# Makiety GUI w FigCraft — projekt

## Cel
Makiety jednego produktu (React, TypeScript, Next.js, TanStack) dla rozszerzeń IV i V zadania COI. Na tym etapie powstają tylko makiety w FigCraft, bez kodu aplikacji. Źródła: `docs/08-implementacja/FRONTEND-BRIEF.md`, kontrakt API (`src/formgen/api/app.py`).

## Cele
- Userflow, widoki, panele, komponenty i paleta w jednym systemie.
- Mobile-first: telefon (390) i tablet (820).
- Motyw jasny i ciemny, język polski i angielski.
- Tokeny nazwane tak, by mapowały się na zmienne CSS Tailwind/shadcn.
- Stany z TanStack Query: ładowanie, błąd, pustka, sukces.

## Poza zakresem
- Desktop (do decyzji później).
- Konta, historia i panel administracyjny: API ich nie obsługuje.
- Kod aplikacji.

## Ograniczenia
- Jeden wygląd dla całego produktu, w tym podglądu e-usługi. Akcent `#0052a5` z brief.
- Brak zależności od CDN w runtime (dotyczy późniejszej implementacji).
- Dostępność: kontrast WCAG AA w obu motywach, cele dotykowe min. 44 px.

## Podejścia
1. Fundament najpierw: zmienne (kolory jasne i ciemne, odstępy, typografia, teksty PL/EN), komponenty, potem ekrany. **Wybrane** — spójność i łatwy przeniesienie do kodu.
2. Ekrany od razu, komponenty na końcu. Odrzucone: ręczne utrzymanie 2 motywów × 2 języków × 2 szerokości.
Ryzyko: jeśli FigCraft nie obsługuje trybów zmiennych, motyw i język robię kopiami ramek.

## Widoki i userflow
Logowanie (JWT) → Upload i kolejka plików (queued, processing, done, error z `error.code`, czas z `X-Processing-Time-Ms`, ścieżka z `X-Extractor`) → Wynik: zakładki JSON / Podgląd / Walidacja (`/validate`: errors, warnings) → Podgląd formularza (kroki, pola wg typów COI, stany dynamiczne SHOW/READ_ONLY) → Wczytaj JSON z dysku → Ustawienia (język, motyw, token) → Stany błędów, pustki i ładowania.

## Dostarczane strony pliku
Fundament (paleta, typografia, odstępy), Komponenty, Userflow (diagram), Ekrany telefon, Ekrany tablet, Stany i błędy.

## Decyzje projektanta (do sprawdzenia)
- Układ nawigacji: dolny pasek na telefonie, boczna szyna na tablecie.
- Czcionka: Inter.
- Weryfikacja: Codex sprawdza makiety względem API i briefu, raport w `docs/08-implementacja/`.
