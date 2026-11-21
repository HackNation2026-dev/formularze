---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Research: synteza i rekomendowany stack (2026-11-21)

5 raportów: `01-lokalny-llm.md`, `02-parsowanie-ocr.md`, `03-generator-formularzy-coi.md`, `04-prior-art.md`, `05-gdzie-uruchomic.md`. Brief: `CONTEXT.md`. Spike'i: `spikes/`.

## Stack (decyzja)



| Warstwa                  | Wybór                                                                                                                                                                              | Licencja           | Fallback                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| App                      | Python 3.14, FastAPI, Pydantic v2, pydantic-settings, `uv`                                                                                                                        | MIT/BSD            | –                                                                            |
| PDF tekstowy             | `pdfplumber` + `pypdfium2` (chars/words/rects, nie `extract_text()`)                                                                                                          | MIT / Apache-BSD   | `docling` (MIT) bez OCR                                                     |
| DOCX / XLSX / ODS        | `python-docx`, `openpyxl`, `odfpy` (pod Apache)                                                                                                                               | MIT / MIT / Apache | docling                                                                       |
| DOC binarny              | sidecar **Apache Tika** `apache/tika:3.3.0.0`, `PUT /tika` -> XHTML z tabelami                                                                                            | Apache-2.0         | LibreOffice headless (MPL, zapytać mentora)                                  |
| Obrazy (OCR, CPU)        | docling image pipeline + **rapidocr** (ONNX, PP-OCRv5 latin / v6 pl) + `docling-layout-heron` (checkboxy, key-value)                                                        | Apache-2.0         | Tesseract 5.5 `pol`                                                         |
| Obrazy (OCR, GPU, bonus) | Unlimited-OCR v1 (MIT) przez llama.cpp GGUF (1660 Ti) / mlx-vlm (M4); polski niezweryfikowany                                                                                       | MIT                | –                                                                            |
| LLM                      | **Qwen3.5-4B Q4_K_M** przez `ghcr.io/ggml-org/llama.cpp:server-b12602` (CPU) / `server-cuda12-b12602`; JSON-schema -> GBNF; `--jinja --reasoning-budget 0`, temp 0–0.2 | Apache-2.0         | Bielik-4.5B-v3.0 (A/B po polsku); upgrade M4/T4: Qwen3.5-9B / Bielik-11B-v3.1 |
| Lint jsonata             | `jsonata-python` 0.7.2                                                                                                                                                            | Apache-2.0         | –                                                                            |
| Dopasowanie etykiet      | `rapidfuzz`                                                                                                                                                                       | MIT                | –                                                                            |
| Walidatory PL            | własne ~60 linii (PESEL, NIP, REGON, dowód, ZIP, ADE, ePUAP) – `spikes/03_validators_check.py`                                                                                 | –                 | –                                                                            |
| Docker                   | `python:3.14-slim` (44 MB) + sidecary llama.cpp, tika; `USER 1000`; wagi jako volume `:ro` z manifestem SHA256                                                                | –                 | Alpine tylko jeśli onnxruntime/rapidocr mają wheel musl (sprawdzić)        |

Odrzucone: clairic (27B, Hopper), PaddlePaddle (brak cp314), unstructured (<3.14), PyMuPDF/MinerU (AGPL), marker/surya/YOLO-checkbox (GPL/AGPL), LayoutLM (CC-BY-NC), Llama-PLLuM/Gemma 3/Ministral (licencje), llama-cpp-python (brak wheel cp314, HTTP wystarczy).

## Architektura pipeline (3 raporty zgodne)

```
upload -> walidacja (nazwa, MIME, rozmiar) -> ingest per format -> wspólny model dokumentu (bloki tekstu, tabele, checkboxy, strona, bbox)
-> segmentacja deterministyczna (sekcje, numeracja, nagłówki) -> LLM call #1 (globalny, krótki): tytuł, typ wnioskodawcy, lista sekcji przedmiotu wniosku, szum do odrzucenia
-> LLM call per sekcja: PŁASKI schemat pośredni (pole: etykieta, typ, opcje, wymagane, walidator, hint zależności z id) z polem `reasoning`
-> grounding (etykieta musi istnieć w tekście sekcji, inaczej odrzuć) -> dopasowanie słowników/danych inicjalnych (rapidfuzz)
-> composer: szablonowe strony (Dane, Kontakt, FINISH), adresy, jsonata z generatora, grid/questionOrder/UUID, flow
-> walidator pydantic + reguły techniczne + lint jsonata -> JSON
```

Powody: prefill dominuje czas (16k tokenów na CPU = 7 min), więc chunk per sekcja + `cache_prompt`; constrained decoding tylko na płaskim schemacie ("constraint tax"); markdown/layout > surowy OCR; VLM 3B pada na checkboxach, więc VLM tylko jako bonus z GPU.

## Fakty, które zmieniają plan

- Obrazy: wszystkie rendery 1654 px × n×2339 px (A4 @ 200 dpi, metadane DPI błędne = 72). Cięcie stałą wysokością działa.
- `kraj` musi mieć `defaultValue: ["Polska"]`, bo `$not(<brak odpowiedzi>)` w jsonata = true (zmierzone).
- `'Dane' in title` = dopasowanie dokładne tytułu taba, nie substring.
- Strony alternatywne nie istnieją w schemacie (`flow.links` bez warunków) -> SHOW na sekcjach jak goldeny.
- Legion: smoke test Unlimited-OCR **nie ruszył** (venv bez torch, model 4.1 GB z ~6.2 GB, download niepełny). Referencyjny kod importuje PyMuPDF (AGPL) – nie używać w produkcie.
- Colab: eksperymenty tak, demo nie (ToS, brak Dockera). Demo = M4 natywny llama-server z Metal + reszta w Compose; backup RunPod A5000 $0.27/h; backup #2 Legion po Tailscale.

## Metryka (do zaimplementowania w 1 h)

Spłaszczone pola liścia, Hungarian match `token_set_ratio >= 80` w obrębie taba; P/R/F1 pól, type_acc, section_acc, show_state_recall, validator_pass. Composite `0.5*F1 + 0.15*type + 0.1*section + 0.1*show + 0.15*valid`. S2 = recall >= 0.8.

## Spike'i do zrobienia (30 min każdy, równolegle)

1. M4: `brew install llama.cpp`, pobrać Qwen3.5-4B Q4_K_M, `llama-bench`, potem 1 wywołanie z JSON schema na sekcji "przedmiot wniosku" z formularza 05. Pytanie: jakość PL + tok/s.
2. Legion: `nvidia-container-toolkit`, `llama-bench` w `server-cuda12`, ten sam model. Pytanie: tok/s prefill/gen na 1660 Ti.
3. CPU: `rapidocr` + `docling-layout-heron` na PNG formularza 05 (po cięciu na strony). Pytanie: czas/strona, czy checkboxy wykryte, czy polskie znaki OK. Sprawdzić wheel cp314 onnxruntime.
4. Tika: `docker run apache/tika:3.3.0.0`, `PUT /tika` z `.doc` formularza 07. Pytanie: tabele zachowane?

## Pytania do mentorów (zebrane)

1. `validation` puste w goldenach – czy mamy wypełniać walidatorami? 2. Nazwy słowników: `TERYT_4G_DOWODOWY` vs Województwo/Powiat/Gmina/Miejscowość – które importowalne? 3. `repeatingSectionGrid` vs `repetingSectionGrid`. 4. Strony alternatywne – czy `flow.links` może mieć warunek? 5. LibreOffice (MPL) jako sidecar OK? 6. Tokeny dla 20 zespołów – do czego?
