---
wersja: 0.4.0
aktualizacja: 2026-11-22
status: implementacja
---

# Architektura (wersja robocza, 2026-11-21)

```
klient ──HTTP multipart──> FastAPI (api/)
   │ 1. walidacja: JWT -> nazwa -> rozszerzenie -> rozmiar (stream) -> MIME (magika)
   │ 2. ingest/   : format -> model dokumentu (bloki tekstu, tabele, kratki, pozycje, strona)
   │                 PDF: pdfplumber+pypdfium2 | DOCX: python-docx | XLSX/ODS: openpyxl/odfpy
   │                 DOC: Apache Tika (sidecar) | JPG/PNG: cięcie na strony A4 -> OCR (tesseract/rapidocr/Unlimited-OCR)
   │ 3. extract/  : kto wnioskuje = deterministycznie ze słownictwa formularza; otwarty model przez API zgodne
   │                 z OpenAI (llama.cpp lokalnie albo ten sam model w chmurze; łańcuch: chmura -> lokalny -> heurystyka;
   │                 JSON-schema grammar): call globalny (tytuł, urząd) + call per chunk 4500 znaków (płaski
   │                 schemat sekcji/pól); ucięty chunk -> retry na połówkach -> skip. Awaria/timeout LLM ->
   │                 HeuristicExtractor (nagłówki, ☐, ____). Grounding: etykieta musi istnieć w tekście.
   │ 4. enrich    : grounding etykiet w tekście, słowniki i dane inicjalne (rapidfuzz), zależności
   │ 5. compose/  : FormSpec -> FormDefinition (szablony strony 1 / kontakt / FINISH, adresy, JSONata, grid, UUID, flow)
   │ 6. schema/   : pydantic + reguły techniczne + lint JSONata; błąd => 500, nigdy niepoprawny JSON
   └──JSON FormDefinition──> klient
```

Zasada: model generuje tylko to, czego nie da się wyliczyć (przedmiot wniosku, typy pól, opcje, zależności).
Reszta to kod. Composer odtwarza strony szablonowe obu JSON-ów wzorcowych COI z wynikiem F1 0.97 (tests/unit/test_compose.py).

Kontenery (compose): `api` (python 3.14 slim, non-root, jedyny port), `llm` (llama.cpp server, wagi jako volume ro),
`tika` (.doc). Na GPU: `llm` z obrazem `server-cuda12-*`, opcjonalny sidecar OCR.


## Zmiany po 21.11

- **Model:** klient `extract/llm_client.py` obsługuje endpoint w chmurze (`LLM_API_KEY`), tryb bez gramatyki JSON dla dostawców, którzy jej nie przyjmują, oraz łańcuch zapasowy `LLM_BASE_URL` -> `LLM_FALLBACK_BASE_URL` -> ekstraktor heurystyczny. Zgoda mentora: model otwarty i możliwy do postawienia u siebie.
- **Słowniki:** nazwy z dokumentu „Słowniki” (Województwo, Powiat, Gmina, Miejscowość, Kraje, Numery kierunkowe) w `compose/dictionaries.py`; pola z modelu o etykietach adresowych dostają słownik i typ SELECT. Trzy proponowane nowe słowniki: `docs/08-implementacja/NOWE-SLOWNIKI.md`.
- **Walidatory:** `schema/validators.py` (PESEL, NIP, REGON, kod pocztowy, dowód, ePUAP, ADE) i `sample_values` w `POST /api/v1/forms/validate`.
- **Interfejs:** `GET /review/` (podgląd PDF obok pól, symulacja JSONata, eksport), opis w `docs/08-implementacja/UI-PRZEGLAD.md`.
- **Wydajność na CPU:** prefiks promptu identyczny między wywołaniami (cache prefiksu llama.cpp), timeout wywołania 600 s.
- **Ewaluacja:** `scripts/eval_suite.py` + `scripts/eval_fast.sh`, cache odpowiedzi modelu, smoke 01/04/05/09.
- **Proces:** `develop` (praca) i `main` (stan na obronę), obie chronione: PR i zielone `tests` + `docs`.
