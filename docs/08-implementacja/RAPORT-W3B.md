---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: zaimplementowane i zweryfikowane na gałęzi feat/gui-next-results
---

# W3b — wynik JSON, walidacja, podgląd

Zaimplementowano trzy trasy wyników, organizmy JsonViewer, ValidationList i FormRenderer, szablon ResultLayout oraz przykłady w katalogu. Atomy, molekuły, silnik W2b i trasy należące do W3a pozostają bez zmian.

## Commity

- `7d3674d` — magazyn wyników, przeglądarka JSON, tabela walidacji, komunikaty PL/EN.
- `4999b53` — renderer e-usługi, hook podglądu, testy renderowanego fixture i sanityzacji.
- Integracja tras, katalog, testy hooków i e2e oraz ten raport: commit kończący W3b; jego hash jest przekazany koordynatorowi.

## Zachowanie

JSON ma kolorowanie tokenami, rozwijanie, limit wysokości, renderowanie zawartości sekcji na żądanie w partiach po 40 elementów, kopiowanie pełnej konfiguracji i pobieranie JSON. Przykład dużego wyniku ma 20 000 elementów.

Walidacja używa `useValidate`, przyjmuje przykładowe wartości jako obiekt JSON i wyświetla errors/warnings w TanStack Table z filtrem i sortowaniem. Osobno pokazuje sample_errors i sample_unknown, brak uwag, błędny JSON, 422 INVALID_FORM_DEFINITION, 422 INVALID_SAMPLE_VALUES oraz 401 z linkiem klienta do logowania i parametrem returnTo.

Podgląd używa TanStack Form i publicznego API silnika W2b. Obsługuje wszystkie typy pól, słowniki z wartościami przykładowymi, REQUIRED, READ_ONLY, domyślne wartości i EXTERNAL_SYSTEM, sanitowany HTML, dodawanie powtórzeń, kroki według flow.links, przerwanie i ponowne rozpoczęcie. Warunki przeliczają się przy zmianach; spóźniona ocena wcześniejszego stanu nie nadpisuje nowszej. Wadliwy warunek jest oznaczony przy polu.

## Kontrakt integracji W3a

Import: `@/features/results`.

```ts
putResult({
  id,
  form: analyzed.form,
  meta: analyzed.metadata,
  sourceFile: file,
});
const result = getResult(id); // StoredResult | undefined
```

`meta` dopuszcza częściowe metadane analizy; `sourceFile` jest opcjonalny. Wyniki żyją w pamięci karty. Przejścia między zakładkami korzystają z nawigacji klienta. ResultLayout otrzymuje dowolną listę `{ id, label, href }`, więc W3c może dodać Źródło i Przegląd. Brak id daje stan z linkiem do uploadu.

## Weryfikacja

| Polecenie w apps/web | Wynik |
|---|---|
| `npm ci` | OK; bez zmian lockfile, audyt: 0 podatności |
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm run test` | OK: 267 testów, 14 plików |
| `npm run build` | OK: produkcyjny build, wszystkie trzy trasy wyników |
| `PLAYWRIGHT_PORT=3102 npm run e2e` | OK: 13 testów Chromium |

`python3 scripts/verify_docs.py` i `git diff --check`: OK. Nie zmieniano kodu Pythona ani zależności aplikacji.

Test renderowanego fixture 05 obejmuje inną osobę, osobę prawną, pełnomocnika, kraj inny niż Polska i przełączenie pól podatku/rachunku na drugim kroku. Dodatkowe testy obejmują sanityzację opisów i zgód, błąd warunku, READ_ONLY, niezależne odpowiedzi powtórzeń i nawigację z pominięciem niepołączonego taba. E2e obejmuje PL/EN, szerokości 390/820, duży JSON, pobieranie, kopiowanie, walidację z błędami, przełączanie osoby i nieistniejący wynik. Istniejący test katalogu dodatkowo obejmuje 360/820, oba motywy i kontrolę celów dotykowych.

## Odstępstwa i ograniczenia

- Rozszerzono minimalnie renderer katalogu o warstwy organisms/templates, ponieważ sam wpis w rejestrze był niewidoczny. Jego test otrzymał 90 sekund na macierz ośmiu wariantów; nie dodawano sztucznych opóźnień.
- Dodano `PLAYWRIGHT_PORT` do konfiguracji Playwright, z niezmienioną wartością domyślną 3100. Równoległe W3a używało tego samego portu, co powodowało przejmowanie i zamykanie serwera przez drugi worktree; końcowy przebieg W3b korzystał z 3102.
- Uprawnienia schowka nadaje wyłącznie test Playwright. Aplikacja pokazuje także komunikat odmowy dostępu.
- Brakujący lokalnie katalog data/input/02_przyklady_json udostępniono do testu zgodności fixtures przez niewersjonowany symlink do oryginałów w głównym checkoutcie. Materiały i ich manifest nie zostały zmienione.
- Silnik W2b adresuje odpowiedzi przez techName, bez identyfikatora instancji powtórzenia. Renderer przechowuje niezależne wartości instancji w TanStack Form, ale ocena JSONata korzysta z ostatniej zmiany dla danego techName; pełna ocena warunków osobno dla każdej instancji wymaga rozszerzenia silnika poza zakresem W3b.
- Wspólna ochrona tras i automatyczne kierowanie do logowania należą do integracji W3a; W3b zapewnia komunikat 401 i link klienta zachowujący pamięć karty.

## Pytania do integracji

Czy rozszerzyć silnik o adresowanie instancji REPEATING_SECTION przed W4, jeżeli takie formularze mają zawierać warunki zależne od konkretnego powtórzenia? Pozostałe kroki W3b są zakończone; nic nie wypchnięto na remote.
