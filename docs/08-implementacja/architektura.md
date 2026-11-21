---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Architektura (wersja robocza, 2026-11-21)

```
klient ──HTTP multipart──> FastAPI (api/)
   │ 1. walidacja: JWT -> nazwa -> rozszerzenie -> rozmiar (stream) -> MIME (magika)
   │ 2. ingest/   : format -> model dokumentu (bloki tekstu, tabele, kratki, pozycje, strona)
   │                 PDF: pdfplumber+pypdfium2 | DOCX: python-docx | XLSX/ODS: openpyxl/odfpy
   │                 DOC: Apache Tika (sidecar) | JPG/PNG: cięcie na strony A4 -> OCR (tesseract/rapidocr/Unlimited-OCR)
   │ 3. extract/  : kto wnioskuje = deterministycznie ze słownictwa formularza; LLM lokalny (llama.cpp,
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
