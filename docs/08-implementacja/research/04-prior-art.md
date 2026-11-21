---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# 04. Prior art: paper form -> digital form schema with AI (stan 2026-11-21)

Scope: what already exists for "blank form -> field list / form schema", what works, what fails, what we can reuse
without copyleft. Claims tagged **[measured]** (number from a primary source), **[reported]** (stated by authors / README,
not independently verified), **[guess]** (our inference).

## 1. TL;DR

- **Nobody ships our exact task open-source.** Academic form understanding (FUNSD/XFUND/CORD/DocVQA, LayoutLM*/LiLT/
  Donut/UDOP) extracts *values from filled forms*, not a schema from a *blank* form. Blank-form "field detection" exists
  only as object detection (CommonForms/FFDNet 2025, Mind-the-Gaps 2026, AutoFormBench 2026) and gives boxes of class
  text/choice/signature - no labels, no grouping, no types. The "form -> JSON form definition" step is done today only by
  prompting a frontier VLM per page image (GOV.UK `form-extractor-prototype`, Flexion `forms-lab`, nathanfhh). Those
  are MIT/Apache prototypes with no evaluation numbers. We are not behind the state of the art; we must build it.
- **Reuse (all non-copyleft):** `docling` (MIT) for PDF/DOCX/XLSX/image -> ordered blocks + tables + markdown;
  `docling-project/docling-layout-heron` (Apache-2.0, RT-DETRv2 via `transformers`, 43M params, ~0.6 s/page on 4 CPU
  threads **[reported]**) which has classes `Checkbox-Selected`, `Checkbox-Unselected`, `Form`, `Key-Value Region`;
  `jbarrow/FFDetr` (Apache-2.0, RF-DETR trained on CommonForms) as a second opinion for text-input / choice / signature
  boxes; `boxdetect` (MIT, OpenCV) for square boxes in scans; `rapidfuzz` (MIT) + Donut-style nTED for evaluation.
- **Do NOT use:** LayoutLMv2/v3/LayoutXLM weights (CC-BY-NC-SA 4.0), FFDNet-S/L (YOLO11 = Ultralytics AGPL
  pipeline, weights licence unstated), DocLayout-YOLO and any Ultralytics-based detector (AGPL), FUNSD data
  (non-commercial terms). XFUND has no Polish (zh/ja/es/fr/it/de/pt).
- **Best technique mix (evidence-ranked):** (1) deterministic layout serialisation (docling markdown/blocks + glyph
  checkbox detection) -> (2) chunk per section, not per page, and ask a local LLM only for what cannot be computed
  (labels, types, options, grouping) with a flat intermediate schema, **not** the final nested COI JSON -> (3)
  constrained JSON decoding only for the final flat schema, with a free "reasoning" field first -> (4) a verification
  pass that drops fields whose label text is not grounded in the source text (SafePassage-style string alignment,
  up to -85 % hallucinations **[reported]**) -> (5) deterministic assembly into `FormDefinition` + pydantic validator.
  VLM-on-image (Qwen2.5-VL-7B) is the strongest single model on forms in the literature (0.89 F1 vs 0.78 text-LLM on
  VRDU **[measured]**; 71.9 ANLS* on CheckboxQA vs 43.6 for the 3B **[measured]**) but 7B VLM is marginal on 6 GB
  VRAM / CPU-only Docker - keep it as the image-input fallback, not the main path.
- **Metric we can implement in 1 h:** field-level F1 with fuzzy label match (rapidfuzz `token_set_ratio` >= 80,
  Hungarian assignment within the same tab), plus type agreement, section-assignment accuracy, and SHOW-state
  recall. Fuzzy threshold 0.8 had 0.984 precision against manual checks in LayIE-LLM **[measured]**.

## 2. Reusable assets (licence-checked)

| Asset | What it gives us | Licence | Polish | Speed / size | Verdict |
|---|---|---|---|---|---|
| `docling` + `docling-core` (IBM) | PDF/DOCX/XLSX/PNG -> DoclingDocument (blocks, reading order, tables, `key_value_items`), markdown/JSON export; `extract_form_fields=True` for AcroForm widgets | MIT | yes (text layer); OCR via Tesseract/EasyOCR plugins | CPU ok; pulls torch | **use** as ingest layer |
| `docling-project/docling-layout-heron` | 17-class layout detector incl. `Checkbox-Selected/Unselected`, `Form`, `Key-Value Region`, `Section-header`, `Table` | Apache-2.0 | language-agnostic | 42.9M params, 0.64 s/img CPU 4 threads **[reported]**; `egret-m` (D-FINE) 19.5M, 0.33 s | **use** for images and as checkbox fallback for PDFs |
| `jbarrow/FFDetr` | Text-input / choice-button / signature boxes on blank forms (CommonForms) | Apache-2.0 (RF-DETR core Apache-2.0) | language-agnostic | not stated; RF-DETR-S class | **optional**, second opinion for field boxes |
| `jbarrow/CommonForms` dataset | 487k pages, COCO boxes text/choice/signature | Apache-2.0 | mostly EN | 163 GB | only if we fine-tune (we will not) |
| `omoured/minicommonform` + `moured/mini-commonforms` | cleaned 65k-page subset, code Apache-2.0, dataset licence unstated | Apache-2.0 (code) | EN | - | reference only |
| `Snowflake-Labs/CheckboxQA` | 579 QA pairs on checkbox semantics, annotations Apache-2.0 | Apache-2.0 | EN | - | reference for failure modes |
| `karolzak/boxdetect` | OpenCV square/checkbox finder + checked-state heuristic | MIT | n/a | ms per page | **use** for scans when heron misses boxes |
| `pdfplumber` (chars with `fontname`, bbox) | detect checkbox glyphs by font + code point in text PDFs | MIT | yes | ms | **use** |
| `python-docx` (`w:sym`, `w14:checkbox`) | DOCX checkbox symbols | MIT | yes | ms | **use** |
| Donut `nTED` (`donut/util.py`, uses `zss`) | normalised tree edit distance on nested dicts | MIT (Donut), zss BSD | n/a | fast | **use** for structure score |
| `rapidfuzz` | fuzzy label matching | MIT | yes (unicode) | fast | **use** |
| `timpaul/form-extractor-prototype` | prompt + JSON schema (15 answer types, `hint_text`, `needs_routing` flag) -> GOV.UK Forms JSON -> rendered multi-page form | MIT | EN, needs Gemini/Claude API | n/a | **borrow the schema design and UX idea** (render immediately), not the code |
| `flexion/forms-lab` | LLM extraction -> "shaping" -> form spec; has an evaluation harness against fixtures | Apache-2.0 | EN, Claude via Bedrock | n/a | borrow the extract/shape split and the fixture-based eval idea |
| `nathanfhh/Digital-Form-with-GPT4-Vision-API` | PDF page image + PyPDF2 text in one prompt -> streamed YAML -> SurveyJS schema | unstated | EN, OpenAI | n/a | idea only: send text **and** image together |
| LiLT (`jpWang/LiLT`), Donut, UDOP | layout transformers for filled-form KIE | MIT code (LiLT weights unstated), MIT, MIT | LiLT via InfoXLM multilingual | needs fine-tuning data | **skip**: wrong task, no PL data |
| LayoutLMv2/v3, LayoutXLM | same | CC-BY-NC-SA 4.0 (weights) | - | - | **banned** (non-commercial) |
| FFDNet-S/L | YOLO11 (Ultralytics) field detector, AP 81.0 overall on CommonForms test **[reported]** | unstated weights, AGPL toolchain | - | - | **banned** |
| DocLayout-YOLO, any `ultralytics` model | layout / checkbox detectors | AGPL-3.0 | - | - | **banned** |
| FUNSD | 199 filled EN forms | "non-commercial, research and educational purposes" | no | - | **banned** for product, ok for reading the paper |
| XFUND | 7 languages, no PL | CC-BY-NC-SA-ish (LayoutXLM release) | **no** | - | skip |
| CORD | 1k Indonesian receipts | CC BY 4.0 | no | - | irrelevant |

## 3. Evidence

### 3.1 Academic: benchmarks and models (do any output a *schema*?)

| Work | Task | Outputs field list of a blank form? | Metric / number | Licence |
|---|---|---|---|---|
| FUNSD (Jaume 2019) | semantic entity labelling (question/answer/header) + linking on filled scans | no (filled) | F1 on entities; LayoutLMv3 ~92 F1 **[reported]** | non-commercial terms |
| XFUND (Xu 2022, ACL Findings) | same, 7 languages | no; **no Polish** | LayoutXLM baseline | NC |
| CORD / DocVQA | receipts KIE / QA | no | - | CC BY 4.0 / - |
| TreeForm (2024, arXiv 2402.05282) | filled form -> nested JSON tree (headers, Q-A pairs, tables) | closest *structure* output, but on filled forms | GAnTED (greedy-aligned nTED) + edge-F1 with Levenshtein node alignment at 0.4; Donut/LayoutXLM 61.5 F1 avg **[measured]** | paper CC BY |
| CommonForms + FFDNet (WACV 2026, arXiv 2509.16506) | blank PDF -> boxes {TextBox, ChoiceButton, Signature} | boxes only, no labels | FFDNet-L @1216px: AP 81.0 (text 71.4 / choice 78.1 / sig 93.5) on own test **[reported]**; claims to beat "a popular commercial PDF reader" qualitatively | data Apache-2.0; model YOLO11 (AGPL toolchain) |
| Mind the Gaps / mini-CommonForms (DAS 2026, arXiv 2609.23679) | same, cleaned labels | boxes only | on the clean test set FFDNet-L drops to mAP50 36.9; TOOD 51.5, DINO 54.2 **[measured]**. Failure modes: choice detectors anchor on the label text instead of the box; signature confused with text | code Apache-2.0 |
| AutoFormBench (2026, arXiv 2603.29832) | 407 real forms, classes checkbox / input line / text box; OpenCV vs YOLOv8/11/26 | boxes only | YOLOv11 best (no numbers on abstract page) | CC0 paper, data unstated |
| CheckboxQA (Snowflake, 2025, arXiv 2504.10419) | QA whose answer depends on checkbox state | no, but tells us how VLMs fail on checkboxes | Qwen2.5-VL-72B 83.2, **7B 71.9, 3B 43.6**, GPT-4o 66.7, human 97.5 ANLS* **[measured]** | annotations Apache-2.0 |
| VAREX (CVPRW 2026, arXiv 2603.15118) | fillable US gov forms, per-document JSON schema, filled programmatically | no (filled), but: "below 4B params structured-output compliance, not extraction, is the bottleneck" **[reported]** | exact-match JSON | - |
| LayIE-LLM design space (2025, arXiv 2502.18179) | IE on layout-rich docs (VRDU, FUNSD) with LLM/VLM | no, but the best ablation of *how* to prompt | see 3.3 | - |
| Public-sector open-model IE (2025, arXiv 2608.18289) | 35 OCR+LLM / VLM configs on student application forms | no | only 4/35 configs > 0.5 F1; VLMs > OCR+LLM except best OCR pipeline; "structural preservation of OCR output is critical" **[measured]** | - |
| Docling layout report (2025, arXiv 2509.11720) | 17-class layout incl. checkboxes / Form / KV region | partially: gives checkbox boxes + form regions | heron-101 78 % mAP overall; no per-class AP published; train counts: Checkbox-Unselected 45k, Form 12.5k, KV-Region 20.6k **[measured]** | Apache-2.0 |

Takeaway: no benchmark scores "label + type + grouping of a blank form". We will have to define the metric ourselves
(section 3.5) and our 2 golden pairs are the only gold.

### 3.2 Open-source projects that turn paper forms into web forms / schemas

- **timpaul/form-extractor-prototype (MIT, GOV.UK)** - page images -> Gemini 2.5 Flash with a JSON schema:
  `pages[] {question_text, hint_text, answer_type(enum 15), options[], answer_settings.input_type, needs_routing}`.
  Renders result as GOV.UK multi-page form in an iframe. Author: "unpredictable", no eval. What is good: a *small
  flat schema* with an enum of answer types that map 1:1 to design-system components, and immediate rendering
  for review. What is missing: no section hierarchy, routing only as a boolean flag, no local model. **[reported]**
- **flexion/forms-lab (Apache-2.0, US gov)** - "extraction" (swappable variants) -> "shaping" into form spec ->
  evaluation harness scoring extraction and shaping against fixtures. Claude via Bedrock. Lesson: separate raw
  extraction from the redesign step and score both. **[reported]**
- **nathanfhh/Digital-Form-with-GPT4-Vision-API** - sends page JPG **and** PyPDF2 text in one prompt, streams YAML,
  re-renders SurveyJS on every valid chunk. Lesson: text layer + image together beats image alone for OCR-prone
  labels. **[reported]**, licence unstated -> read, do not copy.
- **SurveyJS AI Form Response Extractor (MIT)** - opposite direction: schema given, values extracted from a filled
  form. Not useful.
- **Form.io / react-jsonschema-form**: no PDF importer found in either project. **[guess: none exists]**
- **doc2json / ParseHawk (MIT / Apache-2.0)** - local Ollama + Pydantic schema extraction; generic, nothing form-specific.
- **Commercial concepts (banned at runtime, useful as spec):** Adobe Acrobat *Prepare Form* auto-detects from
  underscores/boxes, often misses vector boxes, mislabels checkbox vs radio, needs manual naming (Clemson guide,
  Adobe forums **[reported]**). Google Document AI Form Parser: "does not reliably parse a KVP with an unfilled
  value, such as a blank form"; checkboxes returned as KVP with nearest text, radio buttons unsupported **[reported,
  Google docs]**. Azure Document Intelligence: `selectionMarks` (selected/unselected) as separate elements not tied to
  words **[reported]**. Lesson: even SaaS does not solve blank forms; label-to-box association is the hard part.

### 3.3 Techniques, ranked by evidence for precision on forms

1. **Layout-aware serialisation (markdown with tables, reading order) - strong, cheap.** LayIE-LLM: on FUNSD markdown
   beat raw OCR text 0.490 vs 0.414 F1; on VRDU equal (0.650 vs 0.648); dropping bounding boxes cost 0.018 F1
   **[measured]**. Public-sector study: structural preservation of OCR output mattered more than model size
   **[measured]**. Docling markdown + explicit `[ ]` checkbox tokens is our default input.
2. **Two-stage: segment sections deterministically -> LLM per section - strong [guess backed by chunking data].**
   LayIE-LLM: chunks <= 1024 tokens lost 0.06 F1 vs medium/max chunks, so chunk by *section*, not by fixed size
   **[measured]**. Mind-the-Gaps: fields are defined by whitespace/alignment/nearby labels, so the LLM must see the
   whole section. Section headers (`A.`, `B.1`, `Section-header` class) are reliable split points on Polish forms.
3. **VLM directly on page image emitting JSON - highest quality, hardware-bound.** LayIE-LLM best configs: GPT-4o-vision
   0.902, **Qwen2.5-VL 0.890**, text LLaMA3-70B 0.784 F1 **[measured]**. CheckboxQA: Qwen2.5-VL-7B 71.9 vs 3B 43.6
   ANLS* - the 3B is not good enough for checkboxes **[measured]**. VAREX: <4B models fail on JSON compliance
   **[reported]**. On our GTX 1660 Ti (6 GB) Qwen2.5-VL-7B needs 4-bit and ~1 min/page; on CPU Docker it is too slow
   for 16 pages **[guess]**. Use VLM only for image inputs where OCR text is poor, or as a 2nd pass on the
   "przedmiot wniosku" pages when a GPU is present.
4. **Few-shot with golden examples - mixed; use for format, not for recall.** LayIE-LLM on VRDU: 0-shot 0.650 >
   1/3/5-shot 0.589/0.595/0.580 **[measured]** (examples ate context). Invoice study: few-shot +19 pp over zero-shot
   **[reported]**; LLaMA3-8B medical NER: similarity-selected examples beat random **[reported]**. Our 2 golden pairs
   are 100 kB each - never paste them whole. Paste a **trimmed** example (one section with 3-4 fields in the flat
   intermediate schema) to fix format and naming style (`techName` snake_case, plain-language `title`).
5. **Grammar-constrained decoding - necessary for validity, pay the "constraint tax" carefully.** JSONSchemaBench and
   "Constraint Tax" (2026): hard schema decoding on small models raised validity but cut answer accuracy, up to
   -43.5 pp on a tool-call task; valid-looking JSON with wrong content is the failure mode **[reported]**. Counter-paper
   (2610.35328): no harm when prompt and format are held fixed, and adding a `reasoning` field before the structured
   fields or a generate-then-format two-step recovers accuracy **[reported]**. Practical rule: constrain a **flat**
   schema (list of fields with enum types), put a free-text `notes` string first, never constrain the nested
   FormDefinition. Tooling, all non-copyleft: llama.cpp GBNF / `json_schema` (MIT), `llguidance` (MIT), `xgrammar`
   (Apache-2.0), `outlines` (Apache-2.0), `lm-format-enforcer` (MIT) **[reported]**.
6. **Self-consistency / verification passes - good for precision, cheap to implement.** SafePassage (2025): require
   a verbatim evidence span per extracted item, string-align it to the source, drop or flag unaligned items; up to
   85 % fewer hallucinations, no extra LLM calls **[reported]**. Self-verification (2306.00024) adds an omission pass
   (recall) and an evidence pass (precision). For us: every generated field must carry `source_text` that fuzzy-matches
   a line in the section (rapidfuzz partial_ratio >= 85); otherwise the field is discarded. Majority vote over 3
   samples (temperature 0.7) on the *set of labels* is optional and triples cost - do it only for the applicant-type
   classification (P3), where a single wrong bit changes the whole page-1 template. Schema-based regex cleaning alone
   gave +0.084 F1 in LayIE-LLM **[measured]** - deterministic post-processing is the cheapest precision win.

### 3.4 Checkbox and option detection

- **Text PDFs (our main case).** Checkboxes appear as (a) Unicode glyphs `□ U+25A1`, `☐ U+2610`, `☑ U+2611`,
  `☒ U+2612`, `■ U+25A0`, `▢ U+25A2`, `○ U+25CB` in a normal font; (b) symbol-font characters: Wingdings `0x6F`
  (hollow square, maps to U+1F78F), `0x71/0x72` shadowed squares, `0xFC` check, `0xFE` checked box; Wingdings 2
  `0x52` ☑, `0x54` ☒, `0xA3` □; Symbol font `0x6F` **[reported, Wikipedia chart; verify by rendering]**; (c) drawn
  rectangles (`page.rects` / `page.curves` in pdfplumber, small square with aspect 0.8-1.25 and side 2-6 mm); (d)
  strings like `[ ]`, `( )`, `TAK / NIE`, `*niepotrzebne skreślić`. Detection: iterate `page.chars`, key on
  `(fontname contains Wingdings|Symbol|ZapfDingbats, ord(text))` and on the Unicode set; for symbol fonts
  pdfplumber often yields a Private-Use code point (U+F06F) - normalise by subtracting 0xF000 **[guess, common]**.
  Then associate each box with the text to its right (same line, dx < 2 em), falling back to the left; CheckboxQA
  shows "box on the opposite side of its text" is the top failure mode, so emit both candidates with a confidence.
- **DOCX.** `w:sym w:font="Wingdings" w:char="F06F"`, legacy `w:fldChar FORMCHECKBOX`, and Word 2010 content control
  `w14:checkbox` with `w14:checked`; python-docx exposes the XML (`element.xpath`). **[reported, ECMA-376]**
- **Images / scans.** `docling-layout-heron` classes 13/14 (Checkbox-Selected/Unselected) are the first choice
  (Apache-2.0, RT-DETRv2, ~0.6 s/page CPU **[reported]**). Fallback `boxdetect` (MIT, OpenCV morphology): tune
  `width_range/height_range` to 200 dpi (checkbox ~ 20-40 px), `group_size_range=(1,1)`; checked-state by pixel
  ratio `px_threshold=0.1`. Mind-the-Gaps per-class mAP50 for choice buttons is only 44-64 even for the best
  detectors on clean labels **[measured]** - treat detector output as *candidates*, confirm with nearby text.
- **Not usable:** every YOLO-based checkbox repo found (LynnHaDo/Checkbox-Detection, Roboflow exports, FFDNet)
  is Ultralytics AGPL.

### 3.5 Evaluation: scoring a generated FormDefinition against gold

Existing options: Donut nTED (MIT, `zss` BSD) - structure-only, punishes legitimate regrouping; TreeForm GAnTED +
edge-F1 - designed for filled forms; STED (2025) and NTED+CSA (2026) - research code, not worth the hour; LayIE-LLM
fuzzy match at 0.8 threshold had precision 0.984 vs manual judgement **[measured]** - good enough for labels.

**Proposed 1-hour metric `form_score` (implement in `tests/eval/score.py`):**
1. Flatten both JSONs to leaf fields: `(tab_index, section_title, techName, title, type, options[], required,
   dictionaryName, readOnly, states_count)`; skip template pages (tab "Dane", contact/consents, FINISH) by title so
   we score only what the model actually produced; score template pages separately as exact structural equality.
2. Match predicted to gold fields with Hungarian assignment (`scipy.optimize.linear_sum_assignment`) on cost
   `1 - max(token_set_ratio(title), ratio(techName)) / 100`, accept pairs with similarity >= 80 (rapidfuzz).
3. Report: `field_P/R/F1` (matched pairs), `type_acc` (type equal on matched), `options_jaccard` (for
   RADIO/CHECKBOX/SELECT), `section_acc` (matched field sits in a section whose title fuzzy-matches gold section,
   >= 70), `tab_acc` (same tab index), `required_acc`, `dict_acc`, `show_state_recall` (gold fields with
   `states[SHOW]` that have a SHOW state in prediction whose jsonata references a techName fuzzy-matching the gold
   reference), `validator_pass` (0/1 from the P7 validator), `nted` (Donut util on title-only trees, for the trend).
4. One number for the leaderboard: `score = 0.5*field_F1 + 0.15*type_acc + 0.1*section_acc + 0.1*show_state_recall
   + 0.15*validator_pass`. S2 target (>= 80 % field coverage) = `field_R >= 0.8`.
5. Cross-format test (S3): run score with PDF output as "gold" and PNG output as prediction; demand F1 >= 0.9.

## 4. Gotchas for our constraints

- **Licence traps:** `ultralytics` is pulled transitively by some "layout" packages (DocLayout-YOLO, some PaddleOCR
  forks, `commonforms` package lists it) - add a CI check `pip-licenses --fail-on="GPL;AGPL"`. LayoutLM* weights
  are NC even when the HF card said MIT in old revisions. `camelot` pulls Ghostscript. docling pulls `torch` (BSD) and
  optionally `easyocr` (Apache) / `tesserocr` (MIT) - fine.
- **Docker CPU:** heron 0.6 s/page on 4 EPYC threads **[reported]** -> 16 pages ~10 s, fine. A 7B VLM on CPU is
  minutes per page -> not viable for 16 pages inside S5; keep the VLM path GPU-only and advertised as optional.
- **Long stacked PNGs (1654 x 37424):** no detector accepts that aspect ratio; split on horizontal whitespace bands
  every ~2339 px (A4 at 200 dpi) with +-50 px search for the lowest-ink row, then run per page. **[guess]**
- **Polish diacritics:** fuzzy matching must run on NFC-normalised, casefolded text; rapidfuzz handles Unicode.
  Tesseract `pol` confuses `ł/l`, `ż/ź`; use `token_set_ratio` not `ratio` so one wrong character does not break a match.
- **Our output is a redesign, not a copy** (PROBLEM.md section 3): the metric must not penalise dropping paper fields
  that the template replaces (name, PESEL, address, signature). Keep a stoplist of such labels in the scorer and in
  the extractor's post-filter.
- **Multi-form files** (form 09 has 3 applications): split on `Title`-class blocks / repeated "WNIOSEK" headers before
  extraction, otherwise the LLM merges them.

## 5. Concrete next step: 30-minute spike

```bash
# 1. heron on a rendered page of form 05 (PDF) and on a PNG crop: do we get Checkbox-* / Form / Section-header boxes?
uv pip install "transformers>=4.49" torch pillow pypdfium2 pdfplumber rapidfuzz scipy
python - <<'EOF'
import pypdfium2 as pdfium, torch
from transformers import RTDetrImageProcessor, RTDetrV2ForObjectDetection
pdf = pdfium.PdfDocument("data/input/01_przyklady_formularze/05_nadplata_podatku/05_nadplata_podatku.PDF")
img = pdf[0].render(scale=200/72).to_pil().convert("RGB")
m = "docling-project/docling-layout-heron"
proc, model = RTDetrImageProcessor.from_pretrained(m), RTDetrV2ForObjectDetection.from_pretrained(m)
out = model(**proc(images=[img], return_tensors="pt"))
res = proc.post_process_object_detection(out, target_sizes=torch.tensor([img.size[::-1]]), threshold=0.4)[0]
for s, l, b in zip(res["scores"], res["labels"], res["boxes"]):
    print(model.config.id2label[l.item()], round(s.item(), 2), [round(v) for v in b.tolist()])
EOF

# 2. glyph checkboxes in the text layer: which fonts/codepoints does form 05 actually use?
python - <<'EOF'
import pdfplumber, collections
boxes = "□☐☑☒■▢○●"
with pdfplumber.open("data/input/01_przyklady_formularze/05_nadplata_podatku/05_nadplata_podatku.PDF") as pdf:
    c = collections.Counter()
    for p in pdf.pages:
        for ch in p.chars:
            if ch["text"] in boxes or any(f in ch["fontname"] for f in ("Wingdings", "Symbol", "Dingbat")):
                c[(ch["fontname"], hex(ord(ch["text"])))] += 1
        print("rects", len([r for r in p.rects if 4 < r["width"] < 20 and 0.8 < r["width"]/max(r["height"],1) < 1.25]))
    print(c)
EOF

# 3. scorer skeleton: flatten golden 05 and score it against itself (must give 1.0), then against golden 01 (should be low)
python -c "import json,sys; d=json.load(open('data/input/02_przyklady_json/05_nadplata_podatku.json')); \
print(sum(len(q['field'].get('repeatingSectionGrid',[])) for t in d['tabs'] for q in t['questions']), 'leaf fields')"
```

Decision after the spike: if heron finds `Checkbox-Unselected` boxes on both PDF render and PNG with >= 80 % of
the visible boxes, images get the same pipeline as PDFs (detector -> OCR per block -> markdown) and we skip the VLM
entirely for v1.

## Sources

- XFUND: https://aclanthology.org/2022.findings-acl.253 ; LayoutLMv3 licence thread: https://huggingface.co/microsoft/layoutlmv3-base/discussions/7
- FUNSD terms: https://guillaumejaume.github.io/FUNSD/work/ ; CORD: https://github.com/clovaai/cord ; LiLT: https://github.com/jpWang/LiLT ; UDOP: https://huggingface.co/microsoft/udop-large
- CommonForms: https://arxiv.org/abs/2509.16506 , https://github.com/jbarrow/commonforms , https://huggingface.co/jbarrow/FFDNet-L , https://huggingface.co/jbarrow/FFDetr , https://huggingface.co/datasets/jbarrow/CommonForms
- Mind the Gaps: https://arxiv.org/html/2609.23679 , https://github.com/moured/mini-commonforms ; AutoFormBench: https://arxiv.org/abs/2603.29832
- CheckboxQA: https://arxiv.org/html/2504.10419v1 ; VAREX: https://arxiv.org/html/2603.15118v1 ; TreeForm: https://arxiv.org/html/2402.05282v1
- Docling layout models: https://arxiv.org/html/2509.11720v1 , https://huggingface.co/docling-project/docling-layout-heron , DocLayNet: https://huggingface.co/datasets/docling-project/DocLayNet
- LayIE-LLM design space: https://arxiv.org/html/2502.18179v2 ; public-sector IE: https://arxiv.org/abs/2608.18289
- Constraint tax: https://arxiv.org/pdf/2605.26128 ; constrained decoding revisited: https://arxiv.org/pdf/2610.35328 ; JSONSchemaBench: https://arxiv.org/pdf/2501.10868
- SafePassage: https://arxiv.org/html/2510.00276v1 ; self-verification IE: https://arxiv.org/pdf/2306.00024
- GOV.UK prototype: https://github.com/timpaul/form-extractor-prototype (schema: data/extract-form-questions-schema.json) ; forms-lab: https://github.com/flexion/forms-lab ; nathanfhh: https://github.com/nathanfhh/Digital-Form-with-GPT4-Vision-API
- boxdetect: https://github.com/karolzak/boxdetect ; Wingdings chart: https://en.wikipedia.org/wiki/Wingdings ; ECMA `w:sym`: https://webapp.docx4java.org/OnlineDemo/ecma376/WordML/sym.html
- Google Form Parser blank-form caveat: https://docs.cloud.google.com/document-ai/docs/form-parser ; Azure selection marks: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept/analyze-document-response ; Adobe Prepare Form limits: https://www.clemson.edu/accessibility/digital/guides/pdf/remediation/forms.html
- RF-DETR / D-FINE / RT-DETR licences: https://blog.roboflow.com/rf-detr-vs-alternatives/
