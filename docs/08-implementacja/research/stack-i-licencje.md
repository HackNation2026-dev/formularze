---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Research: stack i licencje (stan 2026-11-21)

Ograniczenia z zadania: Python >= 3.14, tylko open source bez copyleft (AGPL/GPL zakazane),
zero zewnętrznych API/SaaS/LLM-przez-API w runtime, Docker. Jury testuje na nowych plikach live.

Sprzęt dev: Apple M4, 16 GB RAM. Wystarczy na modele 3B–8B w Q4 (llama.cpp / Ollama / MLX).

## Parsowanie wejścia

| Format | Biblioteka | Licencja | Uwagi |
|---|---|---|---|
| PDF (tekstowy) | pdfplumber (+pypdfium2) | MIT / Apache-BSD | layout, tabele, bboxy – kluczowe dla pól formularza |
| PDF (formularz AcroForm) | pypdf | BSD | `get_fields()` – gotowe pola jeśli PDF ma AcroForm |
| PDF (skan) | render przez pypdfium2 -> OCR | | |
| DOCX | python-docx | MIT | tabele = typowa struktura formularza urzędowego |
| DOC (binarny) | LibreOffice headless `soffice --convert-to docx` | MPL-2.0 | osobny proces, nie linkujemy; MPL = słaby copyleft na pliki LO, nie na nasz kod. Brak lokalnie (brew install --cask libreoffice). Alternatywa: antiword/catdoc = GPL -> ZAKAZ |
| XLSX | openpyxl | MIT | |
| ODS | odfpy | Apache-2.0 / GPL dual | używamy pod Apache |
| JPG/PNG | Pillow + OCR | HPND | |
| MIME | python-magic (libmagic) | MIT / BSD | wymagana walidacja treść==rozszerzenie |

ZAKAZANE (copyleft): PyMuPDF/fitz (AGPL), Ghostscript (AGPL), marker-pdf (GPL), surya-ocr (GPL), unoconv (GPL), antiword (GPL), camelot (MIT ok, ale ciągnie ghostscript – uwaga).

## OCR
| Narzędzie | Licencja | Uwagi |
|---|---|---|
| Tesseract + pytesseract | Apache-2.0 | lokalnie jest, instaluję `tesseract-lang` (pol). Słaby na układ formularzy |
| PaddleOCR (PP-OCRv4/v5) | Apache-2.0 | dobry na PL, layout, tabele; cięższy |
| EasyOCR | Apache-2.0 | prosty, PL ok |
| docling (IBM) | MIT | all-in-one: PDF/DOCX/XLSX/obrazy, layout + tabele + OCR, wyjście struktura. Mocny kandydat na warstwę parsowania. Ciągnie torch |
| VLM lokalny (Qwen2.5-VL / Qwen3-VL 3B–8B) | Apache-2.0 | rozumie obraz formularza bezpośrednio -> JSON. Najbardziej "AI", dobre na skany |

## LLM lokalny (ekstrakcja struktury -> JSON)
| Model | Licencja | Uwagi |
|---|---|---|
| Qwen3 4B/8B, Qwen2.5 7B | Apache-2.0 | dobry JSON / structured output, PL ok |
| Bielik 11B v2/v3 (SpeakLeash) | Apache-2.0 | najlepszy PL, 11B Q4 ~7 GB – zmieści się na 16 GB, wolny |
| Gemma 3 4B/12B | Gemma license (nie OSI, ale nie copyleft) | ryzyko licencyjne, unikać |
| Llama 3.x | Llama license | nie OSI, unikać |
| Phi-4-mini | MIT | ok |

Runtime: llama.cpp / llama-cpp-python (MIT), Ollama (MIT), vLLM (Apache). Structured output: GBNF grammar / JSON schema w llama.cpp lub `outlines` (Apache). W Dockerze: CPU inference – model 3B–4B Q4 realny, 7B+ wolno. Potencjał wdrożeniowy = koszt -> mały model + solidny parser deterministyczny.

## Proponowana architektura (hipoteza do weryfikacji po danych z Discorda)
1. `ingest`: walidacja (nazwa, MIME, rozmiar) -> konwersja do wspólnej reprezentacji (bloki tekstu + tabele + bboxy + strona), hybrid: deterministyczny parser per format + OCR/VLM dla obrazów.
2. `extract`: LLM lokalny z JSON-schema (structured output) -> pola, sekcje, strony tematyczne, typy, walidacje.
3. `enrich`: dopasowanie pól do słowników/danych inicjalnych (embedding lokalny lub fuzzy match), propozycja nowego słownika, zależności między polami (reguły widoczności).
4. `validate`: pydantic model wynikowego JSON == schemat COI (z `data/input/02_przyklady_json`).
5. API: FastAPI, JWT, limit rozmiaru z env. Frontend: upload + podgląd JSON + renderer formularza.

## Otwarte pytania (do mentorów COI / Discord)
- Dokładny schemat JSON (jest w materiałach 3.1.I) – kluczowy, bez niego nie ruszamy ekstrakcji.
- Czy "tokeny dla 20 zespołów" = dostęp do LLM API tylko na dev? Potwierdzić, że w runtime zakaz.
- Czy LibreOffice (MPL) jako osobny proces w kontenerze jest akceptowalny dla .doc?
- Czy dopuszczalne modele na licencjach Gemma/Llama (nie copyleft, ale nie OSI)?
