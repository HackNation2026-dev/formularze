---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Research 02: parsowanie dokumentów + OCR (P1/P2) — stan 2026-11-21

Scope: PDF (text layer) / DOC / DOCX / ODS / XLSX / JPG / PNG (stacked A4 pages) -> one intermediate
representation (IR: page, block, bbox, label, text, table cells, checkbox state). No copyleft, offline, Docker, CPU fallback.

## 1. TL;DR recommendation

- **Text PDF: `pdfplumber 0.11.11` (MIT) + `pypdfium2 5.15.2` (Apache-2.0/BSD-3)**, Python 3.14 OK. Use `page.chars/words/rects/lines/curves`
  (not `extract_text()`), own form heuristics (dotted leaders, `□` glyphs, numbered labels, ruled tables via `extract_tables()`).
  Fallback: `docling 2.151.1` (MIT, Py 3.14) PDF pipeline with OCR off — gives layout labels incl. `checkbox_selected/unselected`, `form`, `key_value_region`.
- **Scanned image (PNG/JPG, stacked pages): split at fixed 2339 px (A4 @ 200 dpi; all samples are exact multiples: 2339/4678/14034/37424),
  then `docling` image pipeline with `rapidocr 3.10.0` (Apache-2.0, ONNX, CPU, PP-OCRv5 `latin` / PP-OCRv6 `pl`) + `docling-layout-heron` (Apache-2.0, RT-DETRv2, 42.9M, 17 labels incl. checkboxes).**
  Expect ~5-15 s/page on CPU (reported, EasyOCR-based; RapidOCR should be faster). 16 pages < 5 min.
  Fallback 1: Tesseract 5.5 `pol` (Apache-2.0, apt `tesseract-ocr-pol`) TSV output, no ML runtime. Fallback 2 / GPU boost: **Unlimited-OCR v1 (MIT, 3B MoE / 0.5B active)**
  via llama.cpp GGUF Q4_K_M (1.95 GB; PR #24969 merged 2026-06-24) on GTX 1660 Ti, or `mlx-vlm>=0.6.8` 4-bit on M4. Polish accuracy UNVERIFIED — must test.
- **DOC (binary): Apache Tika 3.3.0 sidecar container (`apache/tika:3.3.0.0`, Apache-2.0, ~165 MB compressed, POI HWPF) -> `PUT /tika` `Accept: text/html`** (XHTML with `<table>`). Same sidecar can also read docx/ods/xlsx/pdf as a universal fallback.
  Fallback: LibreOffice headless `--convert-to docx` (MPL-2.0, separate process, flagged for jury) -> DOCX path. No permissive pure-Python .doc parser exists (antiword/catdoc/wvWare = GPL).
- **DOCX: `python-docx 1.2.0` (MIT), iterate body in order (paragraphs + tables interleaved). ODS/XLSX: `openpyxl 3.1.5` (MIT) + `odfpy 1.4.1` (dual Apache-2.0/GPL — use under Apache)**, or parse `content.xml` with stdlib (`table:number-columns-spanned` = merges). Fallback: docling DOCX/XLSX/ODS backends.
- **Drop from consideration**: PyMuPDF (AGPL; note Unlimited-OCR's own examples import `pymupdf` for PDF->PNG — replace with pypdfium2), marker/surya (GPL), MinerU (AGPL), `hugging-apps/clairic` (27B Cloudflare typed-extraction model, not OCR, Hopper kernels, does not fit 6 GB / 16 GB), PaddlePaddle native (no cp314 wheels; use RapidOCR ONNX instead), EasyOCR (last release 2024-09, torch-heavy).

## 2. Options compared

| Name | Licence | Polish | Speed / VRAM | Structured output | Maturity | Risk for us |
|---|---|---|---|---|---|---|
| **Unlimited-OCR v1** (baidu, 2026-06) | MIT | "multilingual", labels from PaddleOCR (109 langs) — unverified | 3B MoE, 0.5B active; bf16 ~6.2 GB; GGUF Q4 1.95 GB; MLX 4-bit 2.3 GiB; CUDA-only reference code (`.cuda()`, bf16 autocast) | `<|det|>type [bbox]<|/det|>` blocks, 0-1000 bbox, HTML tables; `infer()` gundam/base; `infer_multi()` dozens of pages in 32K ctx | new (5 mo), 5.6M dl/mo, vLLM/SGLang/llama.cpp/MLX | Turing bf16, Py 3.12 pins (transformers 4.57.1), PL unverified, CPU too slow |
| **Unlimited-OCR-2** (2026-10-27) | MIT | same | 3B; pins transformers 4.52.1 + torch 2.13; SGLang needs custom wheel | `<PAGE>/<BLOCK>type<LEVELn>[bbox]<FORK>` + HTML tables, cross-page merge | 4 weeks old; llama.cpp support unconfirmed | too fresh for a jury demo |
| DeepSeek-OCR / -2 | MIT / Apache-2.0 | multilingual, unverified | 3B; >=8 GB VRAM (vLLM recipe) | markdown + grounding | 1 yr; llama.cpp mtmd merged | superseded by Unlimited-OCR |
| **PaddleOCR-VL-1.6** (0.9B) | Apache-2.0 | yes (109/111 langs, Polish in Latin group) | GPU CC>=7.0; CPU via Paddle/transformers (slow); MLX-VLM on Apple | JSON + MD, `block_bbox/label/order`, HTML tables | SOTA OmniDocBench 1.6 (96.33 reported) | PaddlePaddle wheels cp38-cp313 only; T4/Turing "not recommended" |
| **PP-OCRv5/v6 via RapidOCR 3.10** | Apache-2.0 (code + models) | yes (`latin` v5 incl. Polish, 84.7% on Latin set; v6 `pl`) | ONNX CPU, ~0.1-0.3 s per text image (unverified), A4 page ~1-3 s (guess) | lines + boxes only (no layout) | mature | onnxruntime cp314 wheel — verify |
| **Tesseract 5.5.4** + pytesseract 0.3.13 | Apache-2.0 | `pol.traineddata` (tessdata_best 25.9 MB) | CPU, ~2-6 s per A4 @200 dpi (guess) | TSV/hOCR words+bbox | very mature | ~5-7% CER on PL docs (CodeSOTA); no layout |
| EasyOCR 1.7.2 | Apache-2.0 | `pl` via `latin_g2` | torch CPU/GPU, slow | words+bbox | stale (2024-09) | unmaintained; big image |
| docTR 1.1.0 | Apache-2.0 | only via community PARSeq multilingual ckpt | torch; Py 3.14 OK | words+bbox | active | no official PL vocab |
| **docling 2.151.1** | MIT (models: heron Apache-2.0, TableFormer cdla-permissive-2.0) | via OCR engine | CPU median 0.79 s/page (no bitmap OCR); OCR ~13 s/page x86 (EasyOCR) | DoclingDocument: labels incl. checkbox/form/kv, tables, bbox, reading order; MD/HTML/JSON | very active, Py 3.14 | pulls torch (~2 GB image) |
| granite-docling-258M | Apache-2.0 | English primary (ja/ar/zh experimental) | tiny; MLX variant | DocTags | ok | no Polish |
| Qwen3-VL-4B / 2B | Apache-2.0 | 32 OCR langs, list not published | 4B Q4 ~3.3 GB | free-form | mature | not a parser; PL unverified |
| Nanonets-OCR2-3B | not stated on card (base Qwen2.5-VL Apache) | EN/ZH/FR/ES/PT/DE/IT/RU/JA/KO/AR "+more" | 4B bf16 | MD + HTML tables + `☐☑☒` checkboxes | ok | licence unclear -> avoid |
| olmOCR-2-7B | Apache-2.0 | EN-centric | ~12 GB fp8 | MD | ok | too big |
| GOT-OCR2.0 | Apache-2.0 code | EN/ZH | ? | text/format | stale (2025-02) | skip |
| MinerU / marker / surya | AGPL / GPL / GPL | — | — | — | — | **BANNED** |
| pdfplumber 0.11.11 | MIT | n/a | pure Python, 10-80x slower than pypdfium2 (fine for 16 pages) | chars/words/rects/lines/curves + tables | mature, Py 3.14 | reading order needs own logic |
| pypdfium2 5.15.2 | Apache-2.0 / BSD-3 | n/a | fastest; render -> PIL | text + bounds, no layout | mature | ctypes binding |
| pdfminer.six 20260107 | MIT | n/a | slow | LAParams layout, chars w/ font | mature, Py 3.14 | used via pdfplumber |
| pypdf 7.1.1 | BSD-3 | n/a | fast | `extract_text(extraction_mode="layout")`, AcroForm | mature, Py 3.15 | no positions |
| Apache Tika 3.3.0 (docker) | Apache-2.0 (POI, PDFBox) | n/a | JVM sidecar, Java 17 base, ~165 MB / 332 MB full (+tesseract) | XHTML w/ tables for doc/docx/ods/xlsx/pdf | very mature | extra container; Java 17 not 21 (tool, not our code) |
| LibreOffice headless | MPL-2.0 | n/a | ~250-500 MB, no official TDF image | `--convert-to docx/pdf` | mature | licence question for jury; needs own image |
| Gotenberg 9 | MIT image, bundles LibreOffice | n/a | non-root UID 1001, 512 Mi | **PDF output only** | mature | .doc -> PDF -> pdfplumber (2 lossy hops) |
| mammoth 1.13.0 | BSD-2 | n/a | pure Python | docx -> HTML/MD | mature | docx only, no positions |
| python-docx 1.2.0 / openpyxl 3.1.5 / odfpy 1.4.1 | MIT / MIT / Apache-2.0 or GPL | n/a | pure Python | tables, merged cells | mature (odfpy 2020) | odfpy: declare Apache option |
| unstructured 0.27 | Apache-2.0 | n/a | heavy | elements | mature | `requires_python <3.14`; needs libreoffice for .doc |
| clairic (Cloudflare, Space `hugging-apps/clairic`) | Apache-2.0 weights (Space has no licence field) | not stated | 27B (28B bf16) Qwen3.8 fine-tune, flash-linear-attention, Hopper kernels | schema -> typed fields + confidence, <=4 images/PDF pages | preview | not OCR; too large; skip |

## 3. Evidence (primary sources; tags: measured / reported / guess)

**Unlimited-OCR v1** — [model card](https://huggingface.co/baidu/Unlimited-OCR), [GitHub](https://github.com/baidu/Unlimited-OCR), [paper 2606.23050](https://arxiv.org/abs/2606.23050)
- reported: MIT; ~3B params bf16; DeepEncoder (SAM-ViT + CLIP-ViT, 16x token compression) + MoE decoder 3B total / 0.5B active inherited from DeepSeek-OCR; all decoder attention = Reference Sliding Window Attention (window 128); 1024x1024 page = 256 visual tokens.
- reported: modes `gundam` (base_size 1024, image_size 640, crop_mode=True; single page) and `base` (1024/1024/False; multi-page). `infer(tokenizer, prompt, image_file, output_path, base_size, image_size, crop_mode, max_length, no_repeat_ngram_size, ngram_window, save_results)`; `infer_multi(..., image_files=[...])`. Prompt `<image>document parsing.`; `max_length=32768`.
- reported: output = `<|det|>type [bbox]<|/det|>` blocks, bbox normalised 0-1000; tables HTML; images dropped in post-processing. v2 format: `<PAGE>`, `<BLOCK>type<LEVELn>[x1,y1,x2,y2]<FORK>content`, types `title,text,table,image,figure,chart,seal,cross_*,append_*` ([utils/README](https://github.com/baidu/Unlimited-OCR/tree/main/utils)). No checkbox type.
- reported: OmniDocBench v1.5 93.23 / v1.6 93.92 (DeepSeek-OCR-2 89.17/90.25, dots.ocr 88.41/90.77). TPS 5580 vs 4951 DeepSeek-OCR at 512 concurrency (GPU unstated).
- reported: training labels generated by PaddleOCR; languages never listed; HF discussion #22 "Language support" unanswered. **Polish = unknown.**
- reported: reference code is CUDA-only (`.cuda()`, `torch.autocast("cuda", bf16)`); PR [#5](https://huggingface.co/baidu/Unlimited-OCR/discussions/5) makes it device-agnostic (MPS/CPU), still open, users confirm it runs on M-series; discussion #19: `infer()` forces bf16 autocast.
- reported: pins Python 3.12.3, torch 2.10.0, transformers 4.57.1, **pymupdf 1.27** (AGPL, only for PDF->PNG; replace with pypdfium2).
- reported: llama.cpp [PR #24969](https://github.com/ggml-org/llama.cpp/pull/24969) merged 2026-06-24 (converter only, decoder runs full MHA, R-SWA follow-up #24975 open). Run: `llama-mtmd-cli -hf sabafallah/Unlimited-OCR-GGUF:bf16 --image x.png -p "document parsing." --chat-template deepseek-ocr --temp 0 --flash-attn off`. GGUF quants ([DevQuasar](https://huggingface.co/DevQuasar/baidu.Unlimited-OCR-GGUF)): Q4_K_M 1.95 GB, Q8_0 3.13 GB. MLX ([mlx-community 6-bit](https://huggingface.co/mlx-community/Unlimited-OCR-6bit)): mlx-vlm >= 0.6.8, 4-bit 2.29 GiB, 6-bit 2.98 GiB, bf16 6.22 GiB.
- reported (oMLX community bench): DeepSeek-OCR on M4 10-GPU 16 GB: 107 tok/s generation, 2918 tok/s prefill, 4.3 GB peak -> guess 15-40 s per dense A4 page for Unlimited-OCR on M4.
- guess: GTX 1660 Ti (Turing, no bf16): transformers path needs fp16 + `_attn_implementation="eager"` (a Turing-tested DeepSeek-OCR NF4 card says so); bitsandbytes NF4 with `bnb_4bit_compute_dtype=torch.float16`. The Legion `run_test.py` uses bf16 compute dtype -> will be emulated/slow or NaN. llama.cpp CUDA Q4 is the lower-risk path. CPU-only llama.cpp: guess 5-15 tok/s on i7-9750H -> minutes per page, too slow for the jury.
- measured (Legion, 2026-11-21): smoke test NOT run yet — venv has no torch, `model/` = 4.1 GB (bf16 should be ~6.2 GB, download likely incomplete), `nvidia-smi` not in PATH (use `/usr/lib/wsl/lib/nvidia-smi`).

**Unlimited-OCR-2** — [card](https://huggingface.co/baidu/Unlimited-OCR-2): reported MIT, 3B, SR-SWA (fixed 512 working references), released 2026-10-27, pins transformers 4.52.1 / torch 2.13, SGLang custom wheel, ParseBench-2 64.39, 17 community quants; llama.cpp/MLX not stated.

**clairic** — [Space files](https://huggingface.co/spaces/hugging-apps/clairic/tree/main) (Gradio 6.32 `app.py`, ZeroGPU xlarge, requirements: transformers 5.10.2, flash-linear-attention 0.6, xgrammar, pypdfium2), [Cloudflare/clairic](https://huggingface.co/cloudflare/clairic): reported 27B multimodal fine-tune of Qwen3.8-27B, Apache-2.0, "state + schema of typed fields -> structured answers with confidence", <=4 images/PDF pages, Hopper-only kernels (Space swaps them for SDPA on Blackwell). Not an OCR/parser; cannot run on our hardware.

**PaddleOCR-VL-1.6** — [card](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6), [pipeline docs](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL.html): reported Apache-2.0, 0.9B, 109/111 languages (Polish in Latin group per docs FAQ), OmniDocBench 1.6 96.33, output JSON+MD with `block_bbox/block_label/block_order`, HTML tables; CC>=7.0 (Turing OK on Paddle/transformers; vLLM CC>=8.0); x64 CPU + Apple Silicon (MLX-VLM) supported; user report 3.3 GB VRAM with flash-attn. PaddlePaddle wheels cp38-cp313 ([PyPI](https://pypi.org/project/paddlepaddle/)); 3.14 unconfirmed ([issue 17935](https://github.com/PaddlePaddle/PaddleOCR/issues/17935)).

**RapidOCR / PP-OCRv5** — [RapidOCR](https://github.com/RapidAI/RapidOCR), [PyPI 3.10.0](https://pypi.org/project/rapidocr/) (2026-10-08, Apache-2.0 code + MODEL_LICENSES.md), [docling OCR_native](https://docling-project.github.io/docling/concepts/OCR_native/): PP-OCRv5 `latin` family (32 langs incl. Polish, 84.7% acc on PaddleOCR Latin set — reported), PP-OCRv6 lists `pl` directly, 50 langs, "5.2x CPU speedup" (vendor claim). Model sizes tiny/small/medium.

**Tesseract** — [repo](https://github.com/tesseract-ocr/tesseract) Apache-2.0, 5.5.4 latest; Debian `tesseract-ocr-pol`; `pol.traineddata` best 25.9 MB; CodeSOTA Polish panel: Tesseract 5.5.1 CER 5.2-7.3% on clean Polish docs (reported). pytesseract 0.3.13 (2024-08, Apache-2.0, pure Python).

**docling** — [PyPI 2.151.1](https://pypi.org/pypi/docling/json) MIT, `>=3.10,<4`, classifiers 3.13/3.14; [supported formats](https://docling-project.github.io/docling/usage/supported_formats/): PDF, DOCX, XLSX, ODS, images; **DOC requires LibreOffice**. [OCR engines](https://docling-project.github.io/docling/concepts/OCR/): RapidOCR (`model_size` tiny/small/medium), EasyOCR, Tesseract CLI/tesserocr, ocrmac, Nemotron. [Labels](https://github.com/docling-project/docling-core/blob/main/docling_core/types/doc/labels.py): `checkbox_selected, checkbox_unselected, form, key_value_region, field_key, field_value, section_header, list_item, table, page_header, page_footer...`. [docling-layout-heron](https://huggingface.co/docling-project/docling-layout-heron): Apache-2.0, RT-DETRv2 42.9M, 17 classes incl. Checkbox-Selected/Unselected, Form, Key-Value Region. [docling-models](https://huggingface.co/docling-project/docling-models): cdla-permissive-2.0 + apache-2.0 (TableFormer TEDS 93.6). [Tech report](https://arxiv.org/html/2501.17887v1) measured: x86 8 vCPU median 0.79 s/page (avg 3.1), M3 Max 0.32 s (avg 1.26), L4 114 ms; OCR step ~13 s/page x86 / 5 s M3 Max (EasyOCR); docling-parse (qpdf, MIT/Apache) default backend 81 ms/page, pypdfium alternative.

**PDF libs** — [pdfplumber](https://pypi.org/pypi/pdfplumber/json) 0.11.11 (2026-11-21, MIT, Py 3.10-3.14, deps pdfminer.six 20260107 + pypdfium2>=5.15.2); [pypdfium2](https://pypi.org/project/pypdfium2/) 5.15.2 (Apache-2.0 OR BSD-3, PDFium BSD, `to_pil()`); [pdfminer.six](https://pypi.org/project/pdfminer.six/) MIT, Py 3.14; [pypdf](https://pypi.org/project/pypdf/) 7.1.1 BSD-3. Reported (blog benchmarks, conflicting): pypdfium2 10-80x faster than pdfplumber; pdfplumber reading order poor on multi-column -> sort by own clustering. Dotted leaders in the sample PDFs appear as `.` runs in the text layer or as `lines/curves` objects — guess, verify in spike.

**Office** — [Tika formats](https://tika.apache.org/3.2.3/formats.html): `.doc` -> OfficeParser (POI HWPF), `.docx/.xlsx` -> OOXMLParser, `.ods/.odt` -> OpenDocumentParser, PDF -> PDFBox, images -> optional TesseractOCRParser. [tika-docker](https://github.com/apache/tika-docker): tags `3.3.0.0` (minimal) / `3.3.0.0-full` (+Tesseract eng/fra/deu/ita/spa/jpn), Ubuntu + Java 17, port 9998, ~165 / ~332 MB compressed; [TikaServer](https://cwiki.apache.org/confluence/display/TIKA/TikaServer): `curl -T f.doc :9998/tika -H "Accept: text/html"`, `/rmeta`, 422 = unsupported/encrypted, 503 while forked parser restarts. [python-docx](https://pypi.org/pypi/python-docx/json) 1.2.0 MIT; [openpyxl](https://pypi.org/pypi/openpyxl/json) 3.1.5 MIT; [odfpy](https://pypi.org/pypi/odfpy/json) 1.4.1 (2020) classifiers Apache + GPL + LGPL (Debian copyright: "GPL-2+ or Apache-2.0"); [mammoth](https://pypi.org/pypi/mammoth/json) 1.13.0 BSD-2; [textract](https://pypi.org/project/textract/) 2.1.0 MIT but shells out to antiword (GPL) for .doc -> avoid; [unstructured](https://pypi.org/pypi/unstructured/json) `<3.14` + libreoffice. [Gotenberg](https://gotenberg.dev/docs/getting-started/installation): MIT, `gotenberg/gotenberg:9-libreoffice`, non-root 1001, 512 Mi, LibreOffice route = PDF only. LibreOffice: no official TDF Docker image found; community images 250-750 MB.

**Images** — measured (`sips`) on `data/input`: all stacked renders are 1654 px wide, heights 2339 / 4678 / 14034 / 37424 = 1/2/6/16 x 2339 exactly; embedded DPI metadata = 72 (wrong, real 200); 05 variants are 1131x1572 @130 dpi (single page, lower res). Pillow default `MAX_IMAGE_PIXELS` 89.5 Mpx (warn) / 179 Mpx (error) — 1654x37424 = 61.9 Mpx, OK without overrides; RGB in memory ~186 MB. Nanonets-OCR2 renders checkboxes as `☐☑☒` (reported) — useful convention for our IR.

**Python 3.14 fit** — OK: pdfplumber, pdfminer.six, pypdf, pypdfium2, docling, python-doctr, python-docx, openpyxl, mammoth, pytesseract, tesserocr 2.11 (cp314 wheels), torch 2.10 (3.14 wheels, reported). Unverified: rapidocr (classifiers to 3.13; depends on onnxruntime cp314 wheel), mlx-vlm 0.8.0 (`>=3.10`). Not OK: paddlepaddle (cp313 max), unstructured (`<3.14`), Unlimited-OCR reference stack (pinned to 3.12 env; run in its own container if used).

## 4. Gotchas for our constraints

- **Licence**: Unlimited-OCR examples depend on PyMuPDF (AGPL) — never install it; render with pypdfium2. odfpy is dual-licensed: state "used under Apache-2.0" in NOTICE. docling-models TableFormer is CDLA-Permissive-2.0 (permissive, not copyleft). Tika/Gotenberg bundle only Apache/MIT/MPL components; Tika is the only .doc path with zero copyleft discussion. LibreOffice (MPL-2.0) as a subprocess is file-level weak copyleft — acceptable in most readings, but keep it as fallback and ask COI.
- **Python >= 3.14**: our service in 3.14; GPU OCR model (Unlimited-OCR / Paddle) only as a separate sidecar container with its own Python (3.12) or as llama.cpp server (no Python). Decide if the jury accepts a sidecar; Tika sidecar is Java 17 (rule says Java 21 for *our* code; it is a tool).
- **Docker / CPU-only jury run**: baseline must work with no GPU: pdfplumber + docling(RapidOCR, heron) + Tika. Pre-download models at build time (`docling-tools models download`, RapidOCR model files, heron) and set `HF_HUB_OFFLINE=1`; image ~2-3 GB because of torch CPU wheel. Keep Unlimited-OCR as optional `OCR_BACKEND=unlimited` pointing at a llama.cpp/vLLM endpoint on the GPU box.
- **Turing 1660 Ti**: no bf16; flash-attn needs Ampere. Use llama.cpp CUDA (Q4_K_M/Q8_0) or transformers fp16 + eager attention + NF4 with fp16 compute dtype. 6 GB is enough for Q8 weights + 8K ctx (guess).
- **Apple M4**: Unlimited-OCR via mlx-vlm (4/6-bit) — fast dev loop; not available inside Linux Docker, so it is dev-only. Docling on M-series ~0.3 s/page without OCR (measured in report).
- **Long images**: split before any model; the `infer()` resizers downscale to 1024 px so a 37k-px tall image fed whole is garbage. Fixed cut at 2339 px when `height % 2339 == 0`, otherwise horizontal whitespace projection (row ink < 0.5 %, nearest to k*2339). Override DPI to 200 for OCR; for 05 (130 dpi) upscale x1.5 before OCR (guess: improves PL diacritics).
- **Polish diacritics**: Tesseract/RapidOCR Latin models cover ąćęłńóśźż; verify text-layer PDFs for broken ToUnicode (count U+FFFD / ratio of PL letters, fall back to OCR of pypdfium2 render if < threshold). VLM OCRs unverified on PL — test first thing (form 05 has ł/ą/ę dense text).
- **Checkboxes**: text PDFs: `□`/`☐` glyphs (U+25A1/U+2610) or Wingdings private-use chars or drawn `rects` ~8-14 pt square; images: heron labels `checkbox_unselected`; Unlimited-OCR has no checkbox label (may render as `□` in text — unverified).
- **Multi-form files** (09: 3 wnioski): split on `title` blocks / page starts with "WNIOSEK" — downstream concern, but IR must carry page index.
- **Timeouts**: Tika returns 503 while restarting a crashed parser — retry 3x; set `writeLimit`; enforce request-level timeout (e.g. 120 s/page OCR).

## 5. Concrete 30-minute spike

```bash
# M4 (dev): text PDF + image path, pure CPU
cd ~/.t3/projects/hacknation-cyfr-forumla && uv venv --python 3.14 .venv && source .venv/bin/activate
uv pip install "pdfplumber==0.11.11" "pypdfium2==5.15.2" "docling==2.151.1" "rapidocr==3.10.0" onnxruntime pillow
# 1) text layer with positions (form 05)
python - <<'EOF'
import pdfplumber, glob
p = glob.glob("data/input/01_przyklady_formularze/05_*/*.PDF")[0]
with pdfplumber.open(p) as pdf:
    pg = pdf.pages[0]
    print(len(pg.chars), "chars", len(pg.rects), "rects", len(pg.lines), "lines", len(pg.curves), "curves")
    for w in pg.extract_words(keep_blank_chars=False, use_text_flow=True)[:40]: print(round(w["x0"]), round(w["top"]), w["text"])
    print([c["text"] for c in pg.chars if ord(c["text"]) > 0x2500][:20])   # box glyphs?
    print(pg.extract_tables()[:1])
EOF
# 2) split stacked PNG + docling OCR with RapidOCR (Polish)
python - <<'EOF'
from PIL import Image; import glob, pathlib
src = glob.glob("data/input/04_formularze_do_oceny/09_*/*.png")[0]; im = Image.open(src); w,h = im.size
n = h // 2339; assert h % 2339 == 0, h
out = pathlib.Path("/tmp/pages"); out.mkdir(exist_ok=True)
for i in range(n): im.crop((0, i*2339, w, (i+1)*2339)).save(out/f"p{i+1:02d}.png", dpi=(200,200))
print(n, "pages")
EOF
docling --from image --to md --to json --ocr-engine rapidocr --ocr-lang pl --ocr-option model_size=small /tmp/pages/p01.png --output /tmp/dl
grep -c '"checkbox' /tmp/dl/p01.json; head -60 /tmp/dl/p01.md
# 3) Unlimited-OCR on M4 via MLX (dev only)
uv pip install "mlx-vlm>=0.6.8"
python -m mlx_vlm.generate --model mlx-community/Unlimited-OCR-4bit --image /tmp/pages/p01.png --prompt "document parsing." --max-tokens 8192 --temperature 0

# Legion (GTX 1660 Ti, WSL): llama.cpp CUDA instead of the bf16 transformers script
ssh legion 'git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp && cmake -B build -DGGML_CUDA=ON && cmake --build build -j12 --target llama-mtmd-cli llama-server \
 && ./build/bin/llama-mtmd-cli -hf DevQuasar/baidu.Unlimited-OCR-GGUF:Q8_0 --image ~/ocr-test/samples/form_scan.jpg -p "document parsing." --chat-template deepseek-ocr --temp 0 --flash-attn off -ngl 99 -n 4096'
# (if staying on transformers: pip install torch in .venv first; set bnb_4bit_compute_dtype=torch.float16, torch_dtype=torch.float16, _attn_implementation="eager", and patch the bf16 autocast in infer())

# .doc via Tika sidecar
docker run -d --rm -p 127.0.0.1:9998:9998 apache/tika:3.3.0.0
curl -s -T "data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.DOC" http://localhost:9998/tika -H "Accept: text/html" | head -80
```

Decision gate after the spike: (a) pdfplumber chars/rects show dotted leaders + box glyphs -> keep as primary; (b) docling+RapidOCR on p01 reads Polish diacritics with < 3 % visible errors and emits `checkbox_*` labels -> primary for images; (c) Unlimited-OCR Polish output is clean and < 40 s/page on GPU -> keep as optional accelerator, else drop it and save the time.
