---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Licencje zależności (R-20: tylko open source, bez copyleft)

Stan 2026-11-21. Źródło: metadane PyPI / repozytoria. Aktualizować przy każdej nowej zależności.

| Pakiet | Wersja | Licencja | Rola |
|---|---|---|---|
| fastapi / starlette | 0.165.0 / 1.10.0 | MIT / BSD-3 | REST API |
| uvicorn | 0.54.0 | BSD-3 | serwer ASGI |
| python-multipart | 0.0.34 | Apache-2.0 | upload |
| pydantic / pydantic-settings | 2.14.4 / 2.16.3 | MIT | model danych, konfiguracja |
| PyJWT | 2.15.1 | MIT | JWT |
| jsonata-python | 0.7.2 | Apache-2.0 | lint JSONata |
| RapidFuzz | 3.14.6 | MIT | dopasowanie etykiet |
| magika | 1.0.3 | Apache-2.0 | detekcja typu pliku (model ONNX) |
| onnxruntime | 1.32.0 | MIT | runtime magika |
| pdfplumber / pdfminer.six | 0.11.11 | MIT | PDF tekstowy |
| pypdfium2 (PDFium) | 5.15.2 | Apache-2.0 / BSD-3 | render PDF |
| pypdf | 7.1.1 | BSD-3 | PDF (pomocniczo) |
| python-docx | 1.2.0 | MIT | DOCX |
| openpyxl | 3.1.5 | MIT | XLSX |
| odfpy | 1.4.1 | Apache-2.0 (dual z GPL; używane na Apache-2.0) | ODS |
| pytesseract + Tesseract 5 | 0.3.13 | Apache-2.0 | OCR obrazów |
| Pillow | 13.0.0 | MIT-CMU (HPND) | obrazy |
| httpx | 0.28.1 | BSD-3 | klient LLM / Tika |
| llama.cpp (sidecar) | b12602 | MIT | serwer LLM |
| Qwen3.5-4B (wagi) | – | Apache-2.0 | model ekstrakcji |
| Apache Tika (sidecar) | 3.3.0 | Apache-2.0 | konwersja .doc |
| Unlimited-OCR (opcjonalny sidecar GPU) | v1 | MIT | OCR z układem |

Wykluczone świadomie: PyMuPDF (AGPL), Ghostscript (AGPL), MinerU (AGPL), marker/surya (GPL), Ultralytics YOLO (AGPL),
LayoutLMv3 (CC-BY-NC), antiword/catdoc (GPL), LibreOffice (MPL, tylko jako ewentualny fallback .doc po zgodzie mentora).
