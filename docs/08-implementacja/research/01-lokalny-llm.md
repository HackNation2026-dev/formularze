---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# 01 – Lokalny LLM do ekstrakcji pól formularza (P4, P5, P8)

Date: 2026-11-21. Scope: offline model + runtime for turning Polish form text into a strict JSON schema on
(a) MacBook Air M4 16 GB, (b) Legion GTX 1660 Ti 6 GB, (c) CPU-only Docker, (d) rented T4/RunPod.
Claim tags: **[measured]** = we ran it / primary source ran it, **[reported]** = secondary source, **[guess]** = our estimate.

## 1. TL;DR recommendation

- **Runtime: `llama-server` from the official image `ghcr.io/ggml-org/llama.cpp:server-b12602`** (CPU, 295 MB compressed, amd64+arm64)
  and `server-cuda12-b12602` (2.6 GB) for the 1660 Ti. Tags verified today with `docker manifest inspect` [measured].
  Image runs as root -> add `user: "65534:65534"`, mount `/models` read-only. Python 3.14 app talks HTTP (OpenAI-compatible
  `/v1/chat/completions`); do NOT depend on `llama-cpp-python` (no official cp314 wheels [reported]).
- **Primary model: `Qwen3.5-4B` Q4_K_M (2.74 GB GGUF, Apache-2.0, 262k ctx)** – the only candidate that fits all four targets
  with 16k context. Hybrid Gated-DeltaNet: only 8/32 layers keep a KV cache -> 16k ctx costs ~0.5 GB vs ~2.4 GB for Qwen3-8B [computed].
  Run with `--jinja --reasoning-budget 0` (thinking off) and `response_format: json_schema`.
- **Polish A/B candidate: `Bielik-4.5B-v3.0-Instruct` Q4_K_M (Apache-2.0, 32k ctx)** – best Polish score per parameter we found
  (Open PL LLM 56.13 vs Qwen3-8B 55.78, Qwen3-4B 55.49 [reported, SpeakLeash report]). Decide by the form-05 golden test, not by leaderboards.
- **Upgrade when RAM allows (M4 16 GB, T4):** `Qwen3.5-9B` Q4_K_M (5.7 GB) or `Bielik-11B-v3.1-Instruct` Q4_K_M (6.7 GB, Open PL 65.93 for v3.0,
  above Qwen3-14B / gemma-3-12b [reported]). Neither fits the 1660 Ti with 16k context.
- **Structured output: llama.cpp JSON-schema -> GBNF grammar** gives token-level guaranteed-valid JSON for nested arrays/objects/enums,
  but silently ignores `$ref` nesting, `prefixItems`, `pattern` without `^...$`, numeric bounds on `number`. Keep the schema flat (depth <= 3,
  inlined, enums) and validate with pydantic afterwards. The LLM must never emit `FormDefinition` directly – only a small intermediate schema;
  deterministic code builds tabs/grid/UUID/flow/jsonata (P7).
- **Expected speed [guess, bandwidth-based + community tables]:** M4: 4B ~35-45 tok/s, 8-9B ~18-22, 11B ~13-15; 1660 Ti: 4B ~35-45 (fully offloaded),
  9B does not fit; CPU i7-9750H: 4B ~8-12, 8B ~4-6. Prompt processing on CPU (~30-60 tok/s for 4B) dominates: a 16-page form (~12-16k tokens)
  costs 4-8 min just to read on CPU -> chunk per section (sec. 5) and reuse the cached system-prompt prefix.

## 2. Options compared

### Models (all GGUF sizes from HF file listings [measured]; benchmarks [reported])

| Model | Licence | Params / Q4_K_M | Polish | Ctx | JSON / IF | Fits M4 16G / 1660Ti 6G / CPU | Risk |
|---|---|---|---|---|---|---|---|
| **Qwen3.5-4B** (Mar 2026) | Apache-2.0 | 4B (5B w/ vision) / 2.74 GB | 201 langs claimed; no PL benchmark found [gap] | 262k native | IFEval 89.8, BFCL-V4 50.3; tool-calling trained | yes / yes / yes | new hybrid arch in llama.cpp (Feb 2026); thinking on by default |
| **Qwen3.5-9B** | Apache-2.0 | 9B / 5.68 GB | as above | 262k | IFEval 91.5 | yes / no (>6 GB) / slow | same |
| Qwen3-8B (2025) | Apache-2.0 | 8.2B / 5.03 GB | Open PL 55.78 | 40k | good, `/nothink` works | yes / tight (KV 2.4 GB@16k f16) / slow | superseded by 3.5 |
| Qwen3-4B | Apache-2.0 | 4B / ~2.5 GB | Open PL 55.49 | 40k | good | yes / yes / yes | superseded |
| **Bielik-4.5B-v3.0-Instruct** | Apache-2.0 (HF gated form) | 4.8B / ~2.9 GB [guess] | Open PL 56.13; EQ-Bench PL 53.58; CPTUB 3.38 (> Qwen2.5-7B 3.07) | 32k | SFT incl. structured output + tool use (v3 report) | yes / yes / yes | Qwen2.5-arch + own APT4 tokenizer (32k vocab) -> plain llama.cpp |
| **Bielik-11B-v3.1-Instruct** (Nov 2026) | Apache-2.0 | 11.2B / 6.72 GB | v3.0: Open PL 65.93, Belebele 82.98; v3.1 numbers not on card | 32k native, 131k YaRN | SFT structured outputs + function calling; vLLM 0.24+ | yes (~8.5 GB w/ KV) / no / too slow | heavy on CPU |
| Bielik-One 4B/7B/11B-r1 | Apache-2.0 | – | – | – | **decision models, no text output** [reported] | – | not applicable |
| PLLuM-12B-instruct-2512 | Apache-2.0 (Mistral-Nemo base) | 12B / ~7.5 GB [guess] | admin/legal-tuned; older 12B-chat Open PL 52.26; excluded from leaderboard (contamination) | ~128k (Nemo) [guess] | no tool/JSON notes on card | yes / no / no | fewer quants, no published numbers for 2512 |
| PLLuM-4B-*-2512 | tagged Apache-2.0 **but base = gemma-3-4b-pt (Gemma Terms)** -> flag | 4B | admin-tuned | ? | ? | yes / yes / yes | licence ambiguity; skip |
| Llama-PLLuM-8B-2512 | Llama 3.1 (not OSI) | – | – | – | – | – | **banned by our rule** |
| Gemma 4 E4B-it (Apr 2026) | **Apache-2.0** (new; Gemma 3 was Gemma Terms) | 4.5B eff / 8B total; Q4_0 4.59 GB | 35+ langs OOB; PL unverified | 128k | native function calling; MMLU-Pro 69.4 | yes / tight / slow | bigger on disk than its "4B" name; llama.cpp hang report w/o `--reasoning-budget` |
| Phi-4-mini-instruct | MIT | 3.8B / ~2.5 GB | Open PL **43.30**, CPTUB 2.17 | 128k | fn-calling | yes / yes / yes | Polish too weak -> reject |
| SmolLM3-3B | Apache-2.0 | 3B | 6 languages, no Polish | 64k (128k YaRN) | IFEval 76.7 | yes | reject |
| Mistral Small 3.2 24B / Ministral 3 8B | Apache-2.0 | 24B (~14 GB) / 8B | unknown | 128k | good | 24B no; 8B like Qwen3-8B | not tested, no PL data |

### Runtimes

| Runtime | Licence | Platforms we need | Structured output | Maturity | Verdict |
|---|---|---|---|---|---|
| **llama.cpp `llama-server`** | MIT | Metal (M4 native), CUDA 12 (1660 Ti/T4), CPU (Docker amd64+arm64) | JSON-schema -> GBNF, per request or global; `/health`, `/metrics`, slots | official daily images, build b12602 | **use** |
| Ollama 0.40.17 | MIT | same backends (bundles llama.cpp) | `format: <schema>` (also -> grammar) | easy, but 3.4 GB image, root, no `--reasoning-budget`, cannot load unsloth Qwen3.5 GGUF (mmproj issue [reported, unsloth docs]) | fallback only |
| vLLM >= 0.33 | Apache-2.0 | CUDA, compute cap >= 7.5 (T4 ok, fp16), CUDA 13 driver after 0.32, Py 3.11-3.14 | xgrammar / guidance, `response_format json_schema` | not for 1660 Ti (6 GB) nor CPU | rented GPU only (optional) |
| MLX (mlx-lm) | MIT | Mac only, ~10-18 % faster than llama.cpp [reported] | outlines-style libs | not Dockerable | dev only, skip |
| llama-cpp-python | MIT | all | passes grammar | no cp314 wheels, lags upstream | skip; HTTP instead |

## 3. Evidence with links

Models
- Qwen3.5-4B / 9B cards: Apache-2.0, 262,144 ctx, hybrid "3x(Gated DeltaNet) + 1x(Gated Attention)", thinking default on, `enable_thinking:false`
  via `chat_template_kwargs`, 201 languages, IFEval 89.8 / 91.5 [reported]. https://huggingface.co/Qwen/Qwen3.5-4B , https://huggingface.co/Qwen/Qwen3.5-9B
- Qwen3.5-9B config: 32 layers, `full_attention_interval` 4 (8 full-attention layers), 4 KV heads x 256 head_dim [measured, config.json].
  KV/token = 8 x 2 x 4 x 256 x 2 B = 32 KB -> 16k ctx = 0.5 GB f16 [computed]. Qwen3-8B: 36 layers x 8 KV heads x 128 -> 144 KB/token -> 2.4 GB [computed].
- GGUF sizes: unsloth/Qwen3.5-4B-GGUF Q4_K_M 2.74 GB, Q8_0 4.48 GB; unsloth/Qwen3.5-9B-GGUF Q4_K_M 5.68 GB; unsloth/Qwen3-8B-GGUF Q4_K_M 5.03 GB [measured].
  Unsloth RAM table: 4B 4-bit ~5.5 GB, 9B ~6.5 GB total [reported]. https://unsloth.ai/docs/models/qwen3.5.md
- llama.cpp Qwen3.5 support: issue #19957 (Vulkan, Feb 2026) closed fixed; CUDA has full SSM ops [reported]. Community GGUFs run in mainline.
  https://github.com/ggml-org/llama.cpp/issues/19957
- Bielik 11B v3 report (arXiv 2601.11579, Dec 2025): Mistral-7B-v0.2 depth-upscaled, 50 layers, native ctx 32,768, YaRN 131,072; SFT "trained to
  support structured outputs and function calling"; Open PL instruct: Bielik-11B-v3.0 65.93, phi-4 62.57, Qwen3-14B 62.24, gemma-3-12b-it 62.20,
  Bielik-4.5B-v3.0 56.13, Qwen3-8B 55.78, Qwen3-4B 55.49, Mistral-Nemo 55.27, PLLuM-12B-chat 52.26 [reported, PDF extracted locally].
  https://arxiv.org/abs/2601.11579
- Bielik v3 Small report (arXiv 2505.02550): 4.5B ctx 32,768, APT4 tokenizer; EQ-Bench PL 53.58; CPTUB 3.38 vs Qwen2.5-7B 3.07, Phi-4-mini 2.17;
  Polish Medical 43.55 [reported]. https://arxiv.org/html/2505.02550v2
- Bielik-11B-v3.1-Instruct card: Apache-2.0, 56 languages, vLLM 0.24+, gated weights; GGUF repo ungated: Q4_K_M 6.72 GB, Q5_K_M 7.91, Q8_0 11.9 [measured].
  https://huggingface.co/speakleash/Bielik-11B-v3.1-Instruct , https://huggingface.co/speakleash/Bielik-11B-v3.1-Instruct-GGUF
- Bielik-4.5B-v3.0-Instruct card: Apache-2.0, gated, 4.6B [reported]. https://huggingface.co/speakleash/Bielik-4.5B-v3.0-Instruct
- Bielik-One family = decision models with probabilities, no generation [reported, secondary]. https://huggingface.co/speakleash
- PLLuM 2512 family table: 12B base/instruct/chat Apache-2.0 (Mistral-Nemo), 4B Apache-2.0 tag on gemma-3-4b-pt, 8B/70B Llama 3.1; "especially effective"
  for Polish public administration; no numbers on cards [reported]. https://huggingface.co/CYFRAGOVPL/Llama-PLLuM-8B-instruct-2512 ,
  https://huggingface.co/CYFRAGOVPL/PLLuM-12B-instruct-2512 , https://huggingface.co/CYFRAGOVPL/PLLuM-4B-instruct-2512
- Gemma 4: Apache-2.0 ("first Gemma under OSI-approved licence"), E4B = 4.5B effective / 8B total, 128k ctx; ggml-org GGUF Q4_0 4.59 GB [measured].
  https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html , https://huggingface.co/google/gemma-4-E4B-it ,
  https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF
- Phi-4-mini: MIT, Polish listed, 128k [reported]. https://huggingface.co/microsoft/Phi-4-mini-instruct . Open PL 43.30 from the Bielik small report.
- SmolLM3-3B: Apache-2.0, EN/FR/ES/DE/IT/PT only [reported]. https://huggingface.co/HuggingFaceTB/SmolLM3-3B
- Mistral: Small 3.2 Apache-2.0; Ministral 8B (2410) = Research licence, Ministral 3 8B (Dec 2025) Apache-2.0 [reported].
  https://docs.mistral.ai/getting-started/models/weights , https://mistral.ai/news/mistral-3
- Qwen3.5 small-model launch (Mar 2026), 0.8/2/4/9B, Apache-2.0 [reported]. https://artificialanalysis.ai/articles/qwen3-5-small-models

Runtime / structured output
- llama.cpp grammars README: JSON-schema subset; broken: nested `$ref`, `prefixItems`; unsupported: `patternProperties`, `if/then`, `uniqueItems`, `not`;
  `minimum/maximum` only for integer; `pattern` must be `^...$`; `additionalProperties` defaults false; unsupported keys skipped silently; schema is not
  injected into the prompt (describe it yourself); perf caveat issue #4218. https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md
- llama-server README: `response_format {type:"json_schema", json_schema:{schema}}` on `/v1/chat/completions`, `json_schema`/`grammar` on `/completion`,
  `--jinja`, `--chat-template-kwargs`, `--reasoning-budget 0`, `-c`, `-ngl auto|all`, `-ctk/-ctv q8_0`, `-fa`, `-np`, `/health` (503 while loading),
  `LLAMA_ARG_*` env. https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- `--reasoning-budget 0` added in PR #13771 (covers Qwen3 `enable_thinking:false`) [reported]. https://github.com/ggml-org/llama.cpp/pull/13771
- Grammar overhead: DOMINO paper measured llama.cpp grammar mode at 0.74-0.87x unconstrained throughput (2024) [reported]. https://arxiv.org/abs/2403.06988
- Constrained decoding hurts reasoning: "Let Me Speak Freely?" (arXiv 2408.02442), "The Format Tax" (arXiv 2604.03616, Apr 2026), "Thinking Before
  Constraining" (arXiv 2601.07525: reason freely, then constrain; up to +27 %) [reported].
- Ollama structured outputs: JSON schema in `format`, recommends temperature 0 and repeating the schema in the prompt; no formal guarantee stated.
  https://docs.ollama.com/capabilities/structured-outputs . Ollama Dockerfile: `FROM ubuntu:24.04`, no `USER`, `EXPOSE 11434` [measured].
- vLLM GPU install: compute capability >= 7.5 (T4 named), CUDA 13 binaries after 0.32, Python 3.11-3.14; structured outputs backends xgrammar/guidance,
  lm-format-enforcer deprecated. https://docs.vllm.ai/en/latest/getting_started/installation/gpu.html , https://docs.vllm.ai/en/latest/features/structured_outputs.html
- llama-cpp-python: Qwen3.5 fix merged Mar 2026; issue #2136 "no workflow produces 3.14 wheels" [reported]. https://github.com/abetlen/llama-cpp-python/issues/2136

Docker
- `docs/docker.md`: tags `server`, `server-cuda`, `server-cuda13`, `server-vulkan`, ...; mount `-v models:/models` [reported].
  https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md
- `.devops/cpu.Dockerfile`: `ubuntu:26.04`, no `USER`, `HEALTHCHECK curl /health`, `ENV LLAMA_ARG_HOST=0.0.0.0 LLAMA_ARG_PORT=8080` [measured].
- Versioned tags `<variant>-b<build>` (workflow `merged_versioned_tag`), latest `b12602` on the package page [measured].
  `docker manifest inspect` today: `server-b12602` amd64/arm64/s390x, 295 MB compressed; `server-cuda12-b12602` amd64/arm64, 2.64 GB;
  `server-vulkan-b12602` ok; `ollama/ollama:0.40.17` 3.40 GB [measured]. https://github.com/ggml-org/llama.cpp/pkgs/container/llama.cpp

Throughput
- Apple Silicon table (llama.cpp discussion #4167, Llama-2 7B): base M4 (120 GB/s, 10 GPU cores) Q4_0 TG **24.1 tok/s**, PP **221 tok/s**; M4 Pro 50, M4 Max 70-83 [measured by maintainers].
  https://github.com/ggml-org/llama.cpp/discussions/4167 . Bandwidth ceiling for 8B Q4_K_M on 120 GB/s ~24 tok/s [reported].
- 1660 Ti: 288 GB/s, 6 GB; only estimator sites (19-40 tok/s for 7-8B Q4) [reported, unreliable]. CUDA discussion: https://github.com/ggml-org/llama.cpp/discussions/15013
- CPU: i7-13700K ~14 tok/s 8B Q4 [reported]; laptop i7 "< 10 tok/s" [reported]; i7-9750H DDR4-2666 dual channel ~42 GB/s -> 8B Q4 ~4-6, 4B ~8-12 tok/s [guess].
- T4: llama.cpp 8B Q4 ~18.7 tok/s (marked estimated), vLLM AWQ Qwen3-8B ~24 tok/s [reported, unverified].
- Time for 3,000 output tokens [guess]: M4 4B ~75 s, 9B ~150 s, 11B ~220 s; 1660 Ti 4B ~70 s; CPU 4B ~5 min, 8B ~10 min; add ~15-25 % for grammar.

Prompting
- LMDX (arXiv 2309.10952): chunk by page, "entities rarely cross page boundaries" [reported].
- ExtractBench (arXiv 2602.12247, 2026): valid JSON != correct (90 % valid, 12.5 % pass in one domain); models unreliable on long, deeply nested outputs [reported].
- UDA benchmark (arXiv 2510.27119): whole-document systems beat chunked on long docs; chunking loses cross-chunk info [reported].
- Microsoft Azure guide: chunk even when it fits, update fields incrementally with Pydantic validation [reported]. https://techcommunity.microsoft.com/blog/azure-ai-services-blog/-/4397282

## 4. Gotchas for our constraints

- **Licence:** Qwen3.5, Bielik, PLLuM-12B-2512, Gemma 4, SmolLM3, Mistral Small/Ministral 3 = Apache-2.0 (OSI, non-copyleft) – OK. Phi-4-mini MIT – OK.
  Llama-PLLuM (Llama 3.1), Gemma 3, Ministral 8B-2410 – not OSI -> out. PLLuM-4B-2512 inherits Gemma 3 base: treat as Gemma Terms until clarified.
  Bielik safetensors are gated (accept form); GGUF repo for 11B v3.1 is not. Download weights at build-prep time with a token, never at runtime.
- **Docker:** official images run as root -> `user: "65534:65534"`, `read_only: true`, models volume `:ro`, no `LLAMA_CACHE` writes (`-m /models/x.gguf`).
  Pin `server-b12602`; do not use `server` (daily moving tag). Healthcheck is built in; `/health` returns 503 until the model loads (~10-30 s for 4B).
  Docker Desktop on macOS has no Metal passthrough -> containers on the M4 are CPU-only; for dev speed run `brew install llama.cpp` natively and
  point the app at the same URL. GPU in Docker on Legion needs nvidia-container-toolkit in WSL2 (llama.cpp docs: WSL untested).
- **Python 3.14:** no official `llama-cpp-python` cp314 wheels -> app uses `httpx`/`openai` client against llama-server. Decouples model updates from the app.
- **CPU fallback:** prompt processing, not generation, is the budget killer (16k-token form at ~40 tok/s PP = ~7 min). Mitigations: chunk per section,
  `cache_prompt: true` with a shared system-prompt prefix, `-np 2` only if RAM allows (KV per slot), `-t 6` physical cores on the i7-9750H (12 threads oversubscribe).
  Jury target S5 (1-page < 5 min on CPU) is reachable with 4B; 16-page forms need the 10-min budget and parallel sections.
- **6 GB VRAM:** 4B Q4_K_M + 16k ctx fits fully (`-ngl all`); Qwen3-8B/Qwen3.5-9B spill to CPU -> 3-5x slower; use `-ctk q8_0 -ctv q8_0` (needs `-fa on`).
  GTX 1660 Ti is Turing without tensor cores: fp16 OK, bf16 absent (irrelevant for GGUF).
- **Thinking models:** Qwen3.5 and Gemma 4 think by default; always pass `--reasoning-budget 0` (and `chat_template_kwargs.enable_thinking=false`).
  One report of hangs on Gemma 4 / Qwen3.5 with post-April-2026 builds when no budget is set – set it on the server, not per request.
- **Grammar limits:** no `$ref`/`$defs` nesting (inline everything), no `prefixItems`, `pattern` must be anchored, `format: email/uri` ignored, `additionalProperties`
  defaults to false (good). Unsupported keywords are dropped silently -> pydantic validation + retry is mandatory. `max_tokens` truncation still yields
  invalid JSON -> set `n_predict` >= 2x expected and check `finish_reason == "stop"`. Grammar costs ~15-25 % throughput.
- **Quality:** constrained decoding measurably degrades reasoning ("Format Tax"). Let the model produce only judgement calls (field type, label rewrite,
  options, required, repeatable, dependency) and nothing that code can compute (UUIDs, grid x/y, flow, templates, jsonata). Optional two-phase:
  free-text "analysis" call then a short constrained JSON call.
- **Polish diacritics:** all candidates are UTF-8 byte-level tokenizers; Bielik's APT4 tokenizer is ~2x more token-efficient on Polish than Qwen's
  (Bielik v3 tokenizer paper) -> cheaper prompts on CPU. Verify OCR output is NFC-normalised before prompting.
- **Vision:** Qwen3.5 and Gemma 4 GGUFs ship an `mmproj`; we are text-in -> `--no-mmproj`. (Keep in mind as a P1 fallback for images.)

## 5. Prompting strategy recommendation

Two-stage, section-chunked, flat intermediate schema. Reasons: ExtractBench shows long, deep JSON is where models break; LMDX/Azure show page- or
section-level chunking is standard; our forms have explicit section markers (`A.`, `B.1`, numbered items) so the deterministic segmenter (P2) is
cheap and reliable; per-call outputs stay < ~800 tokens, failures retry one section, sections run in parallel slots on GPU.

1. **Deterministic pre-pass (no LLM):** page -> blocks -> sections by header regex; strip known noise (podstawa prawna, pouczenie, podpis/data,
   nagłówek urzędu) with patterns; assign stable `section_id`, `field_hint_id` to every candidate line (dots, checkboxes, table rows).
2. **Global call #1 (short, ~1.5k in / 200 out):** applicant type (osoba / firma / oba / wariant) + list of section titles + which sections are
   "przedmiot wniosku" vs template -> enum JSON. This is P3 and the page split.
3. **Per-section call (N calls, ~0.5-2k in / 100-800 out):** input = section text + previous section's field labels (for cross-references) + one
   compressed golden example. Output schema (inline, depth 3):
   `{"fields":[{"hint_id":str,"label":str,"type":enum13,"required":bool,"options":[str],"validator":enum|null,"repeatable":bool,
   "show_when":{"hint_id":str,"equals":str}|null}]}`. `hint_id` must come from the pre-pass list -> dependencies (P5) resolve to real `techName`s in code;
   anything that points to an unknown id is dropped by the validator, never emitted as broken jsonata.
4. **Code assembles `FormDefinition`:** templates for tab 1 / contact / FINISH, UUIDs, grid, flow links, `states[SHOW]` jsonata from `show_when`, dictionaries by label rules (P6), P7 validator, retry per section on validation failure (temperature 0 -> 0.3).
5. **Whole-form one-shot** only as an experiment for <= 2-page forms; not the production path. Keep thinking off; use `temperature 0-0.2`, `top_k 20`,
   repeat the schema in the system prompt (grammar does not inject it), `cache_prompt: true`.

## 6. Concrete next step: 30-minute spike

```bash
# --- M4 (native, Metal) ---
brew install llama.cpp                                   # provides llama-server, llama-bench
llama-server -hf unsloth/Qwen3.5-4B-GGUF:Q4_K_M --no-mmproj --jinja --reasoning-budget 0 \
  -c 16384 -fa on -ngl all --temp 0 --no-webui --port 8080
llama-bench -m ~/Library/Caches/llama.cpp/unsloth_Qwen3.5-4B-GGUF_Qwen3.5-4B-Q4_K_M.gguf -p 2048 -n 256   # measure PP/TG
# A/B Polish specialist (accept the gate on HF once, download with HF_TOKEN):
huggingface-cli download speakleash/Bielik-4.5B-v3.0-Instruct-GGUF --include '*Q4_K_M*' --local-dir models/
llama-server -m models/Bielik-4.5B-v3.0-Instruct.Q4_K_M.gguf --jinja -c 16384 -fa on --temp 0 --no-webui --port 8081

# --- smoke request (nested arrays + enum, grammar-constrained) ---
curl -s localhost:8080/v1/chat/completions -H 'content-type: application/json' -d '{
 "messages":[{"role":"system","content":"Jesteś ekstraktorem pól formularza. Zwróć JSON zgodny ze schematem: {fields:[{label,type,required,options}]}"},
             {"role":"user","content":"B.1 Rodzaj wniosku: □ nowy □ zmiana  B.2 Numer działki: ........ (obowiązkowe)"}],
 "temperature":0,"max_tokens":600,
 "response_format":{"type":"json_schema","json_schema":{"name":"fields","schema":{
   "type":"object","properties":{"fields":{"type":"array","items":{"type":"object","properties":{
     "label":{"type":"string"},"type":{"type":"string","enum":["TEXT","NUMBER","CHECKBOX","RADIO","SELECT","DATE","TEXTAREA"]},
     "required":{"type":"boolean"},"options":{"type":"array","items":{"type":"string"}}},
     "required":["label","type","required","options"]}}},"required":["fields"]}}}}' | jq .

# --- Legion (WSL2, GTX 1660 Ti) – docker compose service ---
# services.llm: image: ghcr.io/ggml-org/llama.cpp:server-cuda12-b12602   (CPU variant: server-b12602)
#   user: "65534:65534"; read_only: true; volumes: ["./models:/models:ro"]; ports: ["8080:8080"]
#   command: ["-m","/models/Qwen3.5-4B-Q4_K_M.gguf","--jinja","--reasoning-budget","0","-c","16384","-fa","on",
#             "-ngl","all","-ctk","q8_0","-ctv","q8_0","--no-webui","-t","6"]
#   deploy.resources.reservations.devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]   # omit for CPU
docker compose up llm && curl localhost:8080/health
```

Decision gate (1-2 h, from PROBLEM.md step 2): run form 05 through the per-section pipeline with Qwen3.5-4B and Bielik-4.5B; pick by golden-test S2
coverage, then re-check timing on CPU-only (`-ngl 0`) for S5. Open: Qwen3.5 Polish quality has no published benchmark – the spike is the benchmark.
