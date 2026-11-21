---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Spike: OCR na CPU (rapidocr + docling heron) vs Tesseract – 2026-11-21

Cel: sprawdzić ścieżkę CPU-only z `02-parsowanie-ocr.md` §5 (rapidocr PP-OCRv5 latin / PP-OCRv6 pl, docling z layoutem
`docling-layout-heron`) na tych samych dwóch stronach co `ocr-m4-spike.md`, pod Pythonem 3.14. Czysty CPU: bez Metal,
bez CoreML EP (onnxruntime domyślnie CPU EP, `use_coreml: false`).

## Środowisko

- MacBook Air M4, 10 rdzeni, 16 GB. macOS 25.5.
- **Python 3.14.4** (`/opt/homebrew/bin/python3.14`) – wszystko działa, cp314 wheels istnieją. Python 3.13 nie był potrzebny.
- Pakiety (pełna lista w `ocr-cpu-outputs/versions.txt`): rapidocr 3.10.0, onnxruntime 1.32.0, opencv-python-headless 5.1.0.95,
  docling 2.151.1, docling-core 2.108.0, docling-ibm-models 4.0.4, docling-parse 7.27.0, torch 2.15.0 (cp314 arm64 wheel),
  torchvision 0.29.2, transformers 5.24.0, numpy 2.5.5, pillow 13.0.0. Tesseract 5.5.4 (brew) z `pol`.
- venv: 1.6 GB. Modele: heron 164 MB (+163 MB wariant onnx, pobrany przez `docling-tools`), docling-models (tableformer itd.)
  342 MB, rapidocr onnx (v6 small+medium, v5 det+latin rec, cls) 175 MB.
- Wejścia: `ocr-m4-outputs/f05_p1.png` (1127x1568, 130 dpi), `ocr-m4-outputs/f08_p1.png` (1654x2339, 200 dpi).
- Skrypty: `ocr-cpu-outputs/run_rapid.py`, `run_docling.py`, `diacritics.py`.

Metoda liczenia błędów diakrytyków: pierwsze 25 niepustych linii wyniku, każde słowo którego forma bez diakrytyków
występuje w referencji Tesseract (`ocr-m4-outputs/f0X_p1_tess.txt`) ale forma z diakrytykami się różni = 1 błąd.
Dla v5 latin dodatkowo policzone podstawienia ł→t (skrypt ich nie łapie bez drugiego przebiegu). Referencja Tesseract
dla f08 ma w tych 25 liniach 1 własny błąd diakrytyku (`6m`→`ćm`) i 3 sklejenia (`1i2`, `iart.`, `lai`).

## Wyniki

Czasy = drugi przebieg (modele w pamięci, bez pobierania). `init` = utworzenie silnika / pipeline.

| Narzędzie | Obraz | Czas/strona | Błędy diakrytyków (25 linii) | Etykiety checkbox/form | Uwagi |
|---|---|---|---|---|---|
| rapidocr PP-OCRv6 **small** `lang=pl` | f05 | **1.9 s** (det 0.5, rec 1.4) | **0** / 71 słów | n/d | 27 linii, wszystko z bboxami, kropki jako `...` |
| rapidocr PP-OCRv6 small `lang=pl` | f08 | **4.7 s** (det 0.8, rec 3.8) | **4** / 169 słów | n/d | 44 linie. Wszystkie 4 błędy to wielkie litery w nagłówkach: `OPLATY`, `SKLADANA`, `ZOBOWIAZANEGO`, `ZLOŻENIA`. Mały tekst bezbłędny. Trzy kratki `1./2./3.` sklejone w jedną linię |
| rapidocr PP-OCRv6 medium `lang=pl` | f05 | 10.4 s | 0 | n/d | identyczny tekst jak small |
| rapidocr PP-OCRv6 medium `lang=pl` | f08 | 20.1 s | 3 | n/d | tytuł bezbłędny, ale zgubiona cała linia „współwłaściciel, użytkownik wieczysty…” (rec `s U`, score 0.53). 4x wolniej, nie lepiej |
| rapidocr PP-OCRv5 mobile `lang=latin` | f05 | 1.9 s | 12 (10 + 2 ł→t) | n/d | `Urzad`, `nadplaty`, `tytutu`, `zalaczeniu`; zgubiona linia „1) zaliczyć…” |
| rapidocr PP-OCRv5 mobile `lang=latin` | f08 | 3.7 s | **33** (18 + 15 ł→t) | n/d | `Sktadajacy`, `wspótwtaściciel`, `užytkownik`, `WSPÓLMALŽONKA` – model latin nie zna polskiego |
| docling heron + rapidocr v6 small pl | f05 | 9.7 s | 0 / 82 słów (md, 21 linii) | 0 checkbox, 2 `form_area` | 27 itemów. Jedna linia OCR zdegradowana do śmieci (`nal p d p zunn` zamiast „1) zaliczyć na poczet…”, której samodzielny rapidocr czyta dobrze) – docling tnie/skaluje regiony inaczej |
| docling heron + rapidocr v6 small pl | f08 | **8.9 s** | **4** / 197 słów | **5 `checkbox_unselected`**, 1 `form_area`, 0 `form`, 0 `key_value_region`, 0 tabel | 42 itemy, 7 `section_header`, listy. Te same 4 błędy wielkich Ł/Ą co wyżej. Z 6 kratek B.1: 4 jako osobne itemy, kratki 1–3 sklejone w 1 item (sklejenie z OCR), plus fałszywa etykieta na nagłówku „1. Składający deklarację (zaznaczyć…)” |
| docling heron + **tesseract** `pol` | f08 | **7.7–8.0 s** | **0** / 173 słów | **7 `checkbox_unselected`** (6 prawdziwych + 1 fałszywy na nagłówku), 1 `form_area`, 0 tabel | 48 itemów. Kratki 1–6 każda osobno z własnym bboxem. Kropkowane linie jako śmieci (`)............----e--e-eeuseaeaa`). 2x „OSD failed” w logu (nieszkodliwe) |
| (ref) Tesseract CLI psm4 | f08 | 1.4 s | 0 (ref) | brak | z `ocr-m4-spike.md` |
| (ref) Unlimited-OCR 4-bit MLX | f08 | 29 s | ~8 błędnych słów | kratki jako `□` | z `ocr-m4-spike.md`, Metal, nie CPU |

Init i pamięć (docling, `/usr/bin/time -l`, pełne liczby w `ocr-cpu-outputs/time_l_summary.txt`):

| Run | init pipeline | peak RSS | Uwagi |
|---|---|---|---|
| docling + rapidocr, HF online | **96 s** | 2.67 GB | 90 s to huggingface_hub sprawdzające rewizje modeli, mimo że modele były pobrane |
| docling + rapidocr, `HF_HUB_OFFLINE=1` | **6.7 s** | 2.77 GB | f08 end-to-end (init + 1 strona) 20 s wall |
| docling + tesseract, `HF_HUB_OFFLINE=1` | 4.2 s | 1.22 GB | tesseract jako osobny proces, nie liczy się do RSS pythona |
| rapidocr samodzielnie | 0.01 s + ~1 s pierwsze wywołanie | nie mierzone (onnxruntime, rząd setek MB) | |

Surowe wyniki: `ocr-cpu-outputs/` – `*_rapid_<cfg>.txt` (bbox, score, tekst per linia), `*_rapid_<cfg>.json`,
`*_docling_<engine>.md`, `*_docling_<engine>.json` (pełny DoclingDocument z `prov.bbox`).

## Obserwacje

1. **PP-OCRv6 small `pl` czyta polski prawie jak Tesseract**: 0 błędów na f05, 4/169 (2.4 %) na f08 i wszystkie 4 to brak
   ogonków/kreski w WIELKICH literach nagłówków. Drobny druk jest bezbłędny. Dodatkowo zwraca bboxy i score per linia.
   Gęstsze linie czyta czasem jako jedną (kratki 1–3).
2. **PP-OCRv5 `latin` jest nieużyteczny dla polskiego** (20 % słów z błędem diakrytyku, ł→t systematycznie). Rekomendacja
   z research „PP-OCRv5 latin” do odrzucenia; zostaje PP-OCRv6 `pl`.
3. **PP-OCRv6 medium**: 4–5x wolniejszy, 1 błąd mniej, 1 linia zgubiona. Nie warto.
4. **Heron na CPU: ~8–9 s/strona na M4** (sam layout + OCR + reading order). Daje `section_header`, `list_item`,
   `form_area`, `checkbox_unselected`. Nie dał `form`, `key_value_region` ani tabeli (sekcja B.3 to lista linii, nie tabela
   – Unlimited-OCR dawał tam HTML-tabelę).
5. **`checkbox_*` to etykieta linii tekstu, nie kwadratu**: item ma bbox całej linii „4. wspólnota mieszkaniowa”, kwadrat
   nie jest osobnym elementem. Do stwierdzenia „zaznaczona czy nie” na wypełnionym formularzu trzeba albo zaufać
   `checkbox_selected` (niesprawdzone – obie strony są puste; wymaga testu na wypełnionym skanie), albo policzyć piksele
   w lewym marginesie bboxa. Heron też kleprzy nagłówek sekcji z kratkami jako checkbox (1 fałszywy na 7).
6. **Tesseract wewnątrz doclinga wygrywa z rapidocr na tej stronie**: 0 vs 4 błędy, 6/6 kratek osobno (rapidocr: 4/6),
   podobny czas, 2.3x mniej RAM. Minus: śmieci na kropkowanych liniach i zależność od `apt tesseract-ocr-pol` w obrazie.
7. **Docling degraduje OCR względem samodzielnego rapidocr na f05** (130 dpi): linia „1) zaliczyć na poczet…” poszła w
   śmieci, choć sam rapidocr czyta ją ze score 0.98. Prawdopodobnie inna skala/wycinek regionu. Przy 200 dpi (f08) nie
   wystąpiło. Dla skanów < 150 dpi warto upscalować przed doclingiem lub ustawić `images_scale`.
8. **Init online 96 s** – w Dockerze obowiązkowo `HF_HUB_OFFLINE=1` + modele wypieczone w obrazie
   (`docling-tools models download layout tableformer`, cache `~/.cache/docling/models`, ~670 MB; rapidocr onnx ~50 MB
   dla v6 small + cls). Wtedy init 6.7 s. Pipeline trzymać jako singleton w procesie, nie tworzyć per request.

## Blokery

- **cp314: brak blokera.** rapidocr 3.10.0, onnxruntime 1.32.0, opencv-headless 5.1, torch 2.15.0, docling 2.151.1 – wszystkie
  mają wheels `cp314-macosx_arm64`. Nie sprawdzono `cp314-manylinux_x86_64` dla torch/onnxruntime (obraz Docker) – torch
  2.15 i onnxruntime 1.32 publikują manylinux x86_64 dla cp314 na PyPI, ale to trzeba potwierdzić przy budowie obrazu.
- Parametry rapidocr `Det.ocr_version` / `model_type` muszą być enumami (`OCRVersion`, `ModelType`), stringi rzucają
  `TypeError` – docling to już obsługuje, przy bezpośrednim użyciu rapidocr pamiętać.
- `docling-tools models download` pobiera też `docling-layout-heron-onnx` (163 MB), którego pipeline nie używa – do
  wycięcia z obrazu.
- Obraz Docker x86 bez AVX-512 będzie wolniejszy niż M4; 8–9 s/strona na M4 to dolna granica, na typowym vCPU spodziewać
  się 15–30 s/strona (do zmierzenia na Legionie / w kontenerze).

## Werdykt

- **Python 3.14: działa dla całego stosu** (rapidocr + onnxruntime + docling + torch). Nie trzeba schodzić do 3.13.
- **rapidocr PP-OCRv6 small `pl` jako samodzielny OCR tekstu: tak.** 2–5 s/strona CPU, jakość ≈ Tesseract (gorzej tylko na
  WIELKICH Ł/Ą), bboxy i score. Pure pip, bez apt. Lepszy od Tesseracta na kropkowanych liniach (`...` zamiast śmieci).
- **docling + heron jako fallback CPU dla układu i kratek: tak, warunkowo.** Przechodzi bramkę (b) z research
  (< 3 % błędów diakrytyków, emituje `checkbox_*`), ~9 s/strona na M4, 2.7 GB RSS. Daje nagłówki sekcji, listy, `form_area`
  i etykiety kratek na liniach. Nie daje tabel ani kwadratów kratek jako osobnych elementów – detekcja zaznaczenia nadal
  do zrobienia po naszej stronie (piksele w bboxie) lub do sprawdzenia na wypełnionym skanie (`checkbox_selected`).
- **Silnik OCR w doclingu: Tesseract `pol` jeśli apt dostępny, inaczej rapidocr `pl`.** Na tej stronie Tesseract: 0 błędów,
  6/6 kratek osobno, 1.2 GB RAM. rapidocr: 4 błędy (nagłówki), 4/6 kratek, 2.7 GB. Backend wymienny jak w decyzji z
  `ocr-m4-spike.md` (`OCR_BACKEND=unlimited|rapidocr|tesseract`); dla CPU domyślnie `tesseract` w doclingu, `rapidocr` jako
  pure-pip zapas.
- Wymagania dla Dockera: `HF_HUB_OFFLINE=1`, modele w obrazie, pipeline-singleton, upscaling skanów < 150 dpi.
- Nie testowano: wypełniony formularz (`checkbox_selected`), strona z tabelą (f08 p2), czas na x86 w kontenerze.
