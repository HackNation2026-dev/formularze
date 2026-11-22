---
wersja: 0.1.0
aktualizacja: 2026-11-22
status: przyjete ustalenia i material do dalszej obróbki
---

# Kontekst prezentacji (rozmowa 22.11)

Ten dokument zamraza ustalenia z rozmowy o prezentacji, stan wiedzy, na którym stoja slajdy,
oraz przykladowa prezentacje jako material do dalszej obróbki. Uzupelnia [SLAJDY-I-FILM](SLAJDY-I-FILM.md)
i [scenariusze](scenariusze-prezentacji.md); po dalszych decyzjach aktualizuj ten plik.

## 1. Przykladowa prezentacja

- 10 slajdów, 1280x720 (16:9), styl techniczny (jasne tlo, granat #1F3A5F, cienkie linie).
- Zródlo edytowalne: `figcraft/szkice-prezentacji.figcraft`, strona **E - Finalny**. Na tej samej
  stronie obok sa strony A–D (4 szkicowe talie: Rzetelnosc, Historia urzednika, Demo, Decydent)
  do wyluskania elementów.
- PDF przykladowy: `prezentacja-szkic-2026-11-22.pdf` (eksport stron w kolejności odczytu).
- Eksport nowego PDF po edycji w FigCraft: `file.exportFramesPdf` dla strony E - Finalny
  (narzedzia FigCraft) albo recznie z aplikacji.

## 2. Ustalenia (co zostalo przyjete)

| Ustalenie | Decyzja |
|---|---|
| Scenariusz | wlasna struktura zespolu z porannej rozmowy, nie szablony A–D |
| Styl | techniczny (wariant A: jasny, granat, minimalny), nie kremowy narracyjny ani ciemne demo |
| Otwarcie (slajd 1) | wariant 2 „Od papieru do e-uslugi — jednym wsadem." z pilka formatów; 3 warianty otwarcia byly proponowane, wybrano ten |
| Zywych demo na obronie | TAK — demo bedzie; UI w nowym GUI nie jest jeszcze zintegrowane, prezentacja sie tym nie przejmuje |
| Struktura | 10 slajdów: powitanie, trudny przypadek, architektura, jak do tego doszlismy + uzupelnienie o ewaluacje, przeglad /review/, kontrakt COI, wdrozenie i koszt, demo/puenta; slajd 10 = zespol |
| Slajd zespolu | 3 miejsca na zdjecia, pod kazdym opis osoby (imie, nazwisko, rola); reszta dowolna |
| Chipy statusu | DZIALA (zielony), DODATKOWE (pomaranczowy), OGRANICZENIA (szary) — obowiazkowe oznaczenie na slajdach |

## 3. Fakty na slajdach (zweryfikowane w repo 22.11, main `443d2d5`)

| Fakt | Zródlo |
|---|---|
| 9/9 formularzy z JSON-em w `data/output/`, w tym 08_deklaracja_odpady; 0 bledów reguł | README „Pomiary (stan 22.11)", `STAN-PROJEKTU.md` na develop |
| Czas na GPU: 29–300 s na formularz; 05 na CPU po optymalizacjach 207 s -> 122 s | README „Pomiary"; develop `926968d` |
| Golden 05/01: composite 0,92/0,92, recall 0,95/0,96; SCORE smoke 0,7363; eval-warm ~10 s | README „Pomiary" |
| verify_stack.sh 15/15 (x86, bez GPU) | README „Pomiary" |
| Maszyna jury bez GPU; model w chmurze na wlasnej infrastrukturze dozwolony, zapas lokalny | README „Model w chmurze" |
| 08 = deklaracja odpadów: 6 stron, uklad tabelaryczny, sekcje A, B.1, B.2, kratki, daty | `analiza-materialow.md` |
| Determinizm: model tylko tresc wniosku, reszta kodem, walidator gwarantuje poprawny JSON, fallback heurystyczny | `PROBLEM.md` P7, README pipeline |

## 4. Otwarte (przed zgloszeniem)

1. **„~25 min" dla formularza 08 na CPU** — deklaracja zespolu, brak pomiaru w dokumentacji.
   Na slajdzie 02 oznaczone „(pomiar zespolu)". PRZED zgloszeniem: przelicz 08 na CPU i wpisz
   zmierzona liczbe (slajd 02, dokument i STAN-PROJEKTU).
2. Zdjecia i imiona/role na slajd 10 — wymienic placeholdery w FigCraft.
3. Zrzut ekranu `/review/` zamiast makiety na slajdzie 06 (stack z `DEMO-SETUP.md`).
4. Film (max 3 min) — nadal BRAK; minutaż gotowy w [SLAJDY-I-FILM](SLAJDY-I-FILM.md).
5. Termin zgloszenia wg `STAN-PROJEKTU.md` na develop: 22.11 okolo 10:00 — potwierdzic na Discordzie.

## 5. Sugerujemy

- Trzymac na slajdach TYLKO liczby z sekcji 3; kazda nowa liczba musi miec zródlo przed wejsciem na slajd.
- Na obronie slajd 04 („jak doszlismy") prowadzi naturalnie do slajdu 09: opowiedziec penta pomiarów
  jako zdyscyplinowana petle, to gra na „jakosc kodu" (20%).
- Slajd 02 prowadzic uczciwie: najtrudniejszy przypadek zrobiony, czas jest ograniczeniem, optymalizacje
  trwaja (207->122 s jako dowód trendu).
- Nowe GUI pokazac na obronie jako „dalszy rozwoj", stan jury to `/review/` (zgodnie ze STAN-PROJEKTU na develop).
- Po kazdej zmianie slajdów eksportowac PDF do tego katalogu z data w nazwie; nie usuwac starszych
  wersji (historia materialu do obróbki).
