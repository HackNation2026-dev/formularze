---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# Research context (shared brief for research workers)

Task: HackNation 2026, COI "Cyfryzacja formularzy". Build a REST service: upload one file with a paper administrative form
(PDF / DOC / DOCX / ODS / XLSX / JPG / JPEG / PNG), return a JSON `FormDefinition` describing a multi-page digital e-form
for the COI "Generator Formularzy" (mObywatel e-services). Full problem statement: `docs/PROBLEM.md`.
Materials analysis: `docs/analiza-materialow.md`. Golden JSON examples: `data/input/02_przyklady_json/`.
Sample input forms: `data/input/01_przyklady_formularze/`, `data/input/04_formularze_do_oceny/`.

Hard constraints (from the task PDF):
- Python >= 3.14 (or Java 21). Only open-source libraries, NO copyleft (AGPL, GPL banned). PyMuPDF (AGPL), Ghostscript (AGPL), marker-pdf (GPL), surya-ocr (GPL), antiword (GPL), unoconv (GPL) are banned. MPL (LibreOffice) as a separate process is questionable, flag it.
- NO external API / SaaS / MCP at runtime. No LLM reachable only via API (OpenAI, Anthropic, Gemini). Local models only. Cloud GPUs for self-hosted open models are fine (we control the box).
- Must run in Docker (non-root, pinned tags), and the jury runs it live on NEW form files during the defence. Must be robust and finish in minutes, not hours.
- Polish language documents. Forms are 1 to 16 pages. PDFs have a text layer (no AcroForm). Images are A4 renders at ~200 dpi, pages stacked vertically in one PNG (up to 1654 x 37424 px).

Hardware we have:
- MacBook Air M4, 16 GB unified RAM, macOS (dev machine; Metal via llama.cpp / MLX possible).
- "Legion" laptop: Windows 11 + WSL2 Ubuntu, Intel i7-9750H (6c/12t), 11 GB RAM visible in WSL, NVIDIA GTX 1660 Ti 6 GB VRAM (Turing, no bf16, CUDA works in WSL), 930 GB free disk. Reachable over Tailscale SSH as `legion`.
- Google Colab (free T4 16 GB / paid A100) for experiments; RunPod or similar for a demo GPU box. Budget: hackathon-scale, cheap.
- Team already started a smoke test of baidu/Unlimited-OCR on the Legion (nf4 / int8 quantisation via bitsandbytes, `~/ocr-test/run_test.py`). Result unknown yet.

Output format for every research file: Markdown, in Polish or English (English OK), with sections:
1. TL;DR recommendation (3-6 bullets, concrete: what to install, what model/version, expected speed/VRAM).
2. Options compared (table: name, licence, Polish support, speed/VRAM, structured output, maturity, risk).
3. Evidence with links (primary sources: GitHub README, HF model card, docs, benchmarks). Mark each claim measured / reported / guess.
4. Gotchas for our constraints (licence, Docker, CPU-only fallback, long images, Polish diacritics).
5. Concrete next step: commands to run a 30-minute spike.
Keep it under ~250 lines. Do not pad.
