---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Spike: Unlimited-OCR na M4 (MLX) vs Tesseract pol – 2026-11-21

Sprzęt: MacBook Air M4 16 GB, mlx-vlm 0.8.0, Python 3.12 venv (poza projektem). Wejścia: `ocr-m4-outputs/*.png`
(formularz 05 strona 1, 1127x1568 @130 dpi; formularz 08 strona 1, 1654x2339 @200 dpi, wycięta z PNG 6-stronicowego).

| Run | Model | Czas (model w cache) | Wynik |
|---|---|---|---|
| f05 p1 | Unlimited-OCR 4-bit | 34 s | 26 bloków, polskie znaki bezbłędne, typy: header/title/text/image/page_footnote, kropki jako `......` |
| f08 p1 | Unlimited-OCR 4-bit | 29 s | 28 bloków, tytuł „WYOSKOŃCI MIESIĘCZNJE OPLATY”, ~8 błędnych słów, kratki jako `□` z etykietami, puste pola jako bloki `image` z bbox, tabela B.3 jako HTML |
| f08 p1 | Unlimited-OCR 6-bit | 295 s (z pobraniem 3 GB) | te same błędy w tytule, cała strona zapadła w jedną tabelę. Kwantyzacja nie jest przyczyną |
| f08 p1 górna połowa | Unlimited-OCR 4-bit | 22 s | tytuł prawie poprawny („MIESIĘCZNĘJ”), ale znów jedna tabela na całość, kratki jako `☐`, nadal „współtwłaściciel”, „najmca” |
| f05 p1 | Tesseract 5.5 pol psm4 | 0.6 s | bezbłędny tekst, brak układu, brak kratek |
| f08 p1 | Tesseract 5.5 pol psm4 | 1.4 s | tytuł i słowa poprawne, drobny druk z błędami, kropki jako śmieci, kratki zgubione |

Wnioski (measured):
- Unlimited-OCR: układ, typy bloków, tabele HTML, kratki, pozycje pustych pól = wartość dla nas. Słabszy na gęstym polskim tekście niż Tesseract. Niestabilny: ta sama strona raz jako bloki, raz jako jedna tabela.
- Tesseract: tekst lepszy i 25x szybszy, zero struktury.
- 30 s/strona na M4 Metal. 16 stron = 8 min. Na CPU w Dockerze wielokrotnie wolniej (do zmierzenia).

Decyzja robocza: hybryda. Unlimited-OCR (gdy GPU/Metal) do układu i kratek; Tesseract/rapidocr do tekstu w bbox-ach lub jako korekta słów przez dopasowanie. Backend wymienny: `OCR_BACKEND=unlimited|rapidocr|tesseract`. Dla PDF z warstwą tekstową OCR pominięty.
Do zrobienia: pomiar llama.cpp CUDA na Legionie (GGUF Q8) i CPU; test rapidocr PP-OCRv5/v6 pl + docling heron na tej samej stronie.
