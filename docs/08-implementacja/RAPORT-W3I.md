---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: integracja W3a i W3b, gałąź feat/gui-next
---

# W3i — wspólny przepływ aplikacji

## Zmiany

Wyniki analizy i importowane JSON trafiają przez `putResult` do `features/results`: formularz, metadane, opcjonalny plik źródłowy oraz `source: api|local`. Kolejka przechowuje plik, stan, błąd i `resultId`; usunięto jej kopię formularza i lokalny hook wyników. Import dyskowy ma identyfikator `local-*` i nie wywołuje analizy.

Trasy wyników mają wspólny AppShell, status systemu i aktywną pozycję Wynik. Nawigacja prowadzi do ostatnio otwartego wyniku, a przed pierwszym wynikiem do uploadu. Zakładki używają molekuły Tab w wariancie linku z `aria-current`, podkreśleniem aktywnej pozycji i celami co najmniej 44 px. Pozostał dotychczasowy wariant przycisku Tab.

Po sukcesie pojedynczej analizy aplikacja otwiera JSON. Wiersze kolejki i szczegóły mają akcje wyniku, podglądu oraz pobrania JSON. Wspólne `loginHref` i `safeReturnTo` obsługują 401 oraz powrót z logowania do uploadu, ustawień lub konkretnej zakładki wyniku, zachowując pamięć karty.

JsonViewer umieszcza przecinki przy wartościach i końcach obiektów, wyrównuje nawiasy i ogranicza poziome przewijanie do bloku. Kopiowanie i eksport pozostały bez zmian. ChoiceGroup umieszcza legendę nad wewnętrznym obramowaniem. Dolny pasek mieści cztery pozycje przy 390 px; usunięto kolizję kluczy React, gdy dwie pozycje prowadzą do uploadu.

Inicjalizacja motywu jest obecna w pierwszym HTML, a przy zmianie języka nie tworzy kolejnego skryptu React. W trybie dev wskaźnik Next.js jest wyłączony, ponieważ nakładał się na dolną nawigację. Pliki next-env, tsbuildinfo, test-results i playwright-report są ignorowane; next-env usunięto ze śledzenia.

## Commity

- `4916e13` — wspólny magazyn, kolejka, przejścia, auth, powłoka i nawigacja wyników.
- `8c03281` — JSON, grupy pól, inicjalizacja motywu i brak nakładki dev.
- Końcowy commit W3i zawiera e2e, README, aktualizację planu oraz ten raport; jego hash jest przekazany koordynatorowi.

## Weryfikacja

| Polecenie | Wynik |
| --- | --- |
| `npm ci` w apps/web | OK, 0 podatności, bez zmian zależności |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm run test` | OK: 324 testy, 21 plików |
| `npm run build` | OK: wszystkie trasy, produkcyjny build |
| `PLAYWRIGHT_PORT=3113 npm run e2e` | OK: 28 testów Chromium, w tym katalog; końcowy przebieg 3,4 min, bez ponowień |
| `python3 scripts/verify_docs.py` | OK: integralność materiałów i odnośniki |
| `git diff --check` | OK |

Nowe e2e obejmuje pełny przepływ w PL/EN przy 390/820 px, oba motywy, pobranie JSON z wiersza i szczegółów, podgląd, przełączenie osoby, walidację z błędami, lokalny JSON z długą wartością, zmianę języka i powrót do ostatniego wyniku. Oddzielna macierz sprawdza 413, 415, 504 z Ponów, 401 z zachowaną kolejką oraz 401 walidacji z powrotem do tej samej zakładki. Kontrolowane są wyjątki strony, konsola i brak żądań HTTP poza localhost/127.0.0.1. Zrzuty jasnego podglądu i ciemnego wyniku zapisują się w `apps/web/test-results/userflow-*/`; przejrzano układ telefonu i tabletu.

## Odstępstwa i pytania

- Oczekiwane odpowiedzi HTTP 413/415/504/401 generują w Chromium komunikaty konsoli „Failed to load resource”. Test błędów wymaga dokładnie pięciu takich komunikatów we właściwej kolejności; każdy dodatkowy komunikat lub wyjątek powoduje porażkę. Przepływ sukcesu wymaga całkowicie pustej listy błędów konsoli. Aplikacja nie ukrywa diagnostyk przeglądarki.
- Limit oczekiwania asercji e2e wynosi 15 sekund: przy równoległym buildzie kompilacja trasy dev przekroczyła wcześniejsze 5 sekund. Nie dodano opóźnień ani ponawiania testów.
- Brak zmian API backendu, zależności i materiałów organizatora. W3c i W4 pozostają nieodhaczone. Ograniczenie warunków wewnątrz powtórzeń opisane w RAPORT-W3B pozostaje poza zakresem W3i.
- Brak nowych pytań; niczego nie wypchnięto na remote.
