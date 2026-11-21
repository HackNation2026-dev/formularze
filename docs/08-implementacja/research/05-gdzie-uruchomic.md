---
wersja: 0.4.0
aktualizacja: 2026-11-21
status: implementacja
---

# 05. Gdzie uruchomić compute: eksperymenty, demo, historia kosztów wdrożenia

Research date: 2026-11-21. Labels: **[measured]** = a published benchmark/price page read today, **[reported]** = secondary source or vendor claim, **[guess]** = our estimate (bandwidth math or extrapolation).

## 1. TL;DR

- **Experiments (48 h):** Legion GTX 1660 Ti for everything that fits in 6 GB (4B Q4 LLM, OCR VLM at nf4/fp16, 8B Q4 with 4k ctx); **Colab Pro ($9.99 / 100 CU ≈ 84 h of T4 or 58 h of L4)** for anything bigger (8B/11B fp16, vLLM, Unlimited-OCR bf16); M4 for pipeline/dev loop. Do NOT use Colab for the demo (ToS + no Docker + random tunnel URL).
- **Jury demo, primary = MacBook Air M4, fully offline:** `llama-server` native with Metal (outside Docker) + the rest of the stack in Docker Compose talking to `host.docker.internal:8080`. 8B Q4_K_M ≈ 18–24 t/s decode, pp ≈ 220 t/s **[measured for 7B Q4_0, #4167]**: 1-page form ≈ 60–90 s, acceptable for S5. Zero dependency on venue Wi-Fi.
- **Backup #1 = RunPod Secure Cloud pod** (RTX A5000 24 GB $0.27/h or RTX 3090 $0.50/h **[measured, pricing page]**, 48 h ≈ $13–24 incl. storage), running the *same* `docker compose` with GPU override; exposed via RunPod HTTP proxy. Warm it up before the pitch; use it only if venue internet works. Backup #2 = Legion over Tailscale (needs internet on both sides too, WSL2 less predictable). Backup #3 = pre-rendered JSON for the 7 evaluation forms (video only, never present as live).
- **Deployment story (20 % of score):** one mid-range 24 GB card (L4 72 W / RTX 4000 Ada SFF 70 W / Hetzner GEX45 RTX PRO 4000 €214/mo) does ≈ 25–80 forms/h; electricity ≈ 0.003 zł/form, hardware ≈ 0.01–0.05 zł/form. A CPU-only 16-core box does ≈ 3–8 forms/h at ≈ 0.02 zł/form electricity. The *entire* Polish backlog of paper forms (say 20 000) is ≈ 1–2 weeks on one GPU box for a few hundred zł, with no PII leaving the ministry's network. Numbers in §6.
- **Docker:** `nvidia/cuda:12.8.1-runtime-ubuntu24.04` (2.16 GB compressed) or `ghcr.io/ggml-org/llama.cpp:server-cuda-b<N>`; CPU fallback on `python:3.14-slim` (44 MB) + `ghcr.io/ggml-org/llama.cpp:server-b<N>`. Non-root `USER 1000`, weights in a read-only bind volume, `nvidia-container-toolkit` 1.20.2 on the host. Docker on macOS has no Metal; accept CPU-only inside Docker on Mac or run llama-server on the host.

## 2. What fits where (fit table)

Model sizes (GGUF Q4_K_M weights only, add 0.5–1.5 GB KV cache at 8k ctx): 4B ≈ 2.5–3.0 GB, 8B ≈ 4.9 GB, 11B ≈ 6.5–7 GB **[reported, HF file sizes]**. OCR VLM: Unlimited-OCR 3B bf16 ≈ 7 GB, nf4 ≈ 2–2.5 GB **[reported]**; PaddleOCR-VL 0.9B bf16 ≈ 2 GB **[guess from params]**; DeepSeek-OCR bf16 ≈ 6.7 GB, card recommends ≥ 16 GB **[reported]**.

| Target | 4B Q4 | 8B Q4 | 11B Q4 | OCR VLM 3B | PaddleOCR-VL 0.9B | Speed evidence |
|---|---|---|---|---|---|---|
| **M4 16 GB, Metal (native)** | yes, ~30 t/s **[reported]** | yes, 18–24 t/s decode, ~220 t/s pp **[measured 7B Q4_0: 24.1 tg / 221 pp]** | yes but tight with OCR model loaded at the same time; ~14 t/s **[guess]** | yes via llama.cpp GGUF or MLX, image encode 5–20 s/page **[guess]** | yes (PaddlePaddle on CPU/MPS, slow) | #4167 table; fanless Air throttles 15–40 % after 6–30 min **[reported, conflicting]** |
| **M4 inside Docker (CPU only)** | yes, ~10–15 t/s **[guess]** | yes, ~6–10 t/s, pp ~40–80 t/s **[guess]** | marginal | slow | slow | No Metal passthrough in Docker Desktop **[measured, Docker docs]** |
| **GTX 1660 Ti 6 GB (CUDA fp16, no tensor cores, no bf16)** | yes, full offload | tight: 4.9 GB + KV; use `-c 4096`, `-ctk q8_0`, or `-ngl 28` partial offload | no (partial offload, <5 t/s) | fp16 7 GB **no**; **nf4 yes** (bitsandbytes NF4 needs cc ≥ 6.0, int8 needs cc ≥ 7.5, 1660 Ti is 7.5) **[measured, bnb docs]** | yes | GTX 1660 (non-Ti): 41 tg / 149 pp Q4_0 7B **[measured, #15013]**; 1660 Ti ~45–50 tg, pp stays ~150–200 (no tensor cores) **[guess]** |
| **CPU only, i7-9750H 12 t, DDR4** | ~8 t/s **[reported, i7 DDR4 laptop]** | ~4–6 t/s, pp ~20–40 t/s **[guess]** | no | too slow (minutes/page) | borderline | Use `-t 6` (physical cores); 12 threads can be slower **[reported]** |
| **Colab free T4 16 GB** | yes | yes, 46 tg / 1219 pp Q4_0 7B **[measured, #15013]** | yes | bf16 **no** (Turing) → fp16 or nf4; vLLM needs `--dtype float16` | yes | vLLM Qwen3-8B AWQ ≈ 24 t/s **[reported]** |
| **Colab Pro L4 24 GB / A100 40 GB** | yes | yes | yes | yes (PaddleOCR-VL on A10-class: 0.74 pages/s **[measured, paper]**) | yes | L4 est. 56–67 t/s 8B Q4 **[reported, calculator]**; A100 far more |
| **RunPod RTX A5000 / 3090 / 4090 (24 GB)** | yes | A5000 130 tg / 4028 pp; 3090 158 / 5175; 4090 186 / 11993 **[measured, #15013]** | yes | yes bf16 (Ampere+) | yes (4090D: 1.15 pages/s with vLLM **[measured, paper]**) | |
| **Hetzner GEX45 (RTX PRO 4000 Blackwell SFF 24 GB)** | yes | ~60–70 t/s **[guess from RTX A4000 Ada 61.8 tg measured]** | yes | yes | yes | dedicated, €0.3429/h, €209 setup |

Key takeaway: for *our* workload prompt processing dominates (a 16-page form is 10–30k input tokens). The 1660 Ti and the M4 are both ~150–220 t/s pp, so a 16-page form costs 1–3 min of prefill alone; a T4 is 5× faster at prefill, an A5000 20×.

## 3. Cost table (prices read 2026-11-21 unless noted)

| Option | Price | 48 h demo box | Public port | Persistent volume | Docker | Setup time | Verdict |
|---|---|---|---|---|---|---|---|
| Colab free | $0 | n/a | tunnel only, **disallowed on free tier** ("bypassing the notebook UI to interact primarily via a web UI", SSH/remote control) **[measured, FAQ]** | Drive only | no | 2 min | experiments: light only; demo: **no** |
| Colab Pro | $9.99/mo = 100 CU; T4 ≈ 1.19 CU/h, L4 ≈ 1.71, A100 ≈ 5.4 **[reported, Mar 2026]** | ~$10 | tunnel allowed with positive CU balance, but no uptime, URL changes on restart, 12–24 h cap | Drive | no | 2 min | experiments: **yes**; demo: **no** |
| RunPod Secure Cloud | A5000 $0.27/h, 3090 $0.50, 4090 $0.89, L4 $0.69, A40 48 GB $0.59 **[measured]** | A5000 ≈ $13, 3090 ≈ $24, 4090 ≈ $43 + volume $0.10/GB/mo (50 GB ≈ $0.35) | yes: `https://<pod>-<port>.proxy.runpod.net` or TCP port | yes (volume disk or network volume $0.07/GB/mo, mounted `/workspace`) | yes, custom image from any registry | 15–30 min | **demo backup: yes** |
| RunPod Community | 3090 $0.22, 4090 $0.34, A5000 $0.16 | ≈ $8–16 | same | same | yes | same | OK for experiments; hosts can be flaky |
| Vast.ai | 3090 median $0.20 (from $0.09), 4090 median $0.50 (from $0.27) **[reported, Nov 2026]** | ≈ $10–24 | random external port on shared IP, "not guaranteed" **[measured, docs]** | per host | yes | 15 min | experiments yes; demo risky |
| Lambda | A10 $1.29/h, A100 40 GB $1.99/h **[reported, lambda.ai]** | $62–96 | yes (VM) | yes | yes | 10 min | overkill |
| OVHcloud Public Cloud | L4 €0.75/h (IE), L40S €1.40/h; US $1.00/h L4 **[reported, price pages]** | ≈ €36 | yes (VM, public IP) | yes | yes | 15 min | EU data residency story, but pricier |
| Hetzner GEX45 | €0.3429/h, €214/mo cap, **€209 setup**, HEL1 **[measured]** | ≈ €225 (setup kills it) | yes, dedicated IP | yes, 2×512 GB NVMe | yes | 1–24 h provisioning | not for 48 h; **the** on-prem/EU cost anchor for the pitch |

## 4. Colab verdict

- **Experiments: yes.** Buy Colab Pro ($9.99) rather than relying on free T4: free GPU availability is not guaranteed, sessions cap at ~12 h, idle disconnect ~90 min **[reported]**, and Google states limits "vary over time" **[measured, FAQ]**. A100 at 5.4 CU/h eats the 100 CU in 18 h, so use T4/L4 for OCR smoke tests and keep A100 for vLLM batch runs.
- **Demo: no.** (1) Free tier: SSH/remote desktop and "interacting primarily via a web UI" are listed as disallowed and sessions "may be terminated at any time without warning" **[measured, FAQ]**. Paid balance lifts that list, but (2) no Docker daemon in Colab, so S6 (`docker compose up`) can't be shown; (3) a cloudflared quick tunnel has "no uptime guarantee", random `trycloudflare.com` hostname per process, test-only **[measured, Cloudflare docs]**; (4) Pro runtimes still stop at 12–24 h. For a jury that uploads files live this is a self-inflicted outage risk.

## 5. Demo-day plan

**Primary: M4 native (offline).** Rationale: the only option with zero external dependencies; venue Wi-Fi is historically the #1 hackathon failure. Quality loss vs the cloud 8B/11B: on the M4 we still run **8B Q4_K_M** (≈ 5 GB + 2 GB OCR VLM + app fits in 16 GB with `sudo sysctl iogpu.wired_limit_mb=12288`); we only drop to **4B** if the 8B blows S5 on 16-page forms. Expect 4B to lose on P5 (jsonata dependencies) and on section grouping, not on field extraction. Run with `--parallel 1`, `-c 8192`, `--flash-attn on`, plug in mains power, lid open, cool room (thermal throttling).

**Backup #1: RunPod Secure pod**, same repo, `docker compose -f compose.yml -f compose.gpu.yml up`. Pre-pull images, download weights to the volume, run one full form the evening before, keep it running through the pitch ($0.27–0.50/h). Expose port 8000 as HTTP; the UI on the Mac points at it via an env var. Use it only if a 10-second health check from the venue passes.

**Backup #2: Legion via Tailscale.** Tailscale is WireGuard: direct path ≈ LAN latency when both devices are on the same Wi-Fi (even without internet once keys are cached), else DERP relay adds 20–100 ms **[guess]**. Latency is irrelevant for a 60 s job; the risk is WSL2: pinned/managed memory is limited **[measured, NVIDIA WSL guide]**, user reports of CUDA throughput degrading over days until driver restart **[reported]**. Mitigation: reboot Legion the morning of, `wsl --shutdown`, verify `nvidia-smi` inside WSL and inside a container.

**Checklist (T-24 h):**
1. `docker compose up` from a clean clone on the M4 (CPU profile) and on RunPod (GPU profile); run all 16 files from `01_przyklady_formularze` through the validator (S1).
2. Weights pinned by SHA256 in `models/MANIFEST`, present on all three machines; `llama-server` native binary + launch script on the M4 (`make serve-metal`).
3. Timing table per machine for a 1-page and a 16-page form (S5); choose 8B vs 4B per machine from that table, not from hope.
4. Phone hotspot tested as venue-internet replacement for Backup #1/#2.
5. UI `BACKEND_URL` switchable without rebuild; health endpoint shown on screen before upload.
6. Pre-rendered JSON for the 7 evaluation forms and a 3-min screen recording, in case everything dies (never present as live).
7. Battery/power: Air on mains, Low Power Mode off, no other heavy apps, Spotlight indexing finished.

## 6. Deployment-cost story for COI

Assumptions (label **[guess]** unless noted): average form 4 pages; per page ≈ 3k input tokens (OCR text + schema + examples) and ≈ 1.5k output tokens; so ≈ 12k in + 6k out per form plus one OCR pass per page. Electricity 1.04 zł/kWh gross G11 2026 **[measured, rankomat]**; business C11 offers 0.44–0.49 zł/kWh net + distribution, so 0.8–1.0 zł/kWh all-in **[reported]** — we use 1.0 zł/kWh.

| Deployment | Throughput (8B Q4) | Forms/h | Power | Electricity/form | Hardware/form | Notes |
|---|---|---|---|---|---|---|
| CPU-only server, 16 cores DDR5 (e.g. Hetzner AX ~€80/mo or existing VM) | tg ≈ 10 t/s **[reported]**, pp ≈ 80 t/s **[guess]** | 12k/80 + 6k/10 ≈ 12.5 min → **≈ 4–5/h** (≈ 8/h with 4B) | ≈ 150 W | 0.15 kWh/h ÷ 4.5 ≈ **0.03 zł** | €80/mo ÷ (4.5 × 720) ≈ **€0.025 (0.11 zł)** | fits "laptop/CPU" rule in the brief; fine for a ministry processing 50 forms/day |
| Single mid-range GPU on-prem: L4 (72 W TDP **[measured, NVIDIA]**, $1.5–3k card **[reported]**) or RTX 4000 Ada SFF 70 W | pp ≈ 2000–2800 t/s, tg ≈ 55–65 t/s **[guess from A4000 Ada 61.8 measured]** | single stream ≈ 1.8 min → ≈ 30/h; with vLLM 4–8 concurrent ≈ **60–100/h** | 70 W + 100 W host | 0.17 kWh/h ÷ 60 ≈ **0.003 zł** | $2.5k card + $2k host over 3 y ÷ (60 × 2000 h) ≈ **$0.04 (0.15 zł)**; at 100 % utilisation 10× cheaper | fits in a 1U/SFF chassis, no datacenter power needed |
| Rented EU GPU: Hetzner GEX45 €214/mo **[measured]**, OVH L4 €0.75/h **[reported]** | as above | 60–100/h | n/a | included | €214 ÷ (60 × 720) ≈ **€0.005 (0.02 zł)** at full load; ≈ 0.3 zł/form at 10 forms/day | data stays in EU, dedicated box, no PII to a third-party model vendor |
| Hypothetical commercial LLM API (round numbers, cheap tier $0.15/$0.60 per M tokens; frontier tier $3/$15) **[guess]** | n/a | unlimited | n/a | n/a | cheap tier ≈ $0.006 (0.02 zł)/form; frontier ≈ $0.13 (0.5 zł)/form + OCR API | **forbidden by the brief**; PII (PESEL, addresses) leaves the ministry; per-call cost grows with pages; vendor can change model/price |

Pitch line: *"Whole backlog of ~20 000 paper forms in Poland = ~2 weeks on one 70 W card, ~60 zł of electricity, zero bytes of citizen data leaving the ministry. Same Docker image runs on a CPU VM for the long tail."* (20 000 ÷ 60 per h ≈ 330 h ≈ 14 working days; 330 h × 0.17 kWh × 1 zł ≈ 56 zł.) Mark the throughput as projected until we measure it on the RunPod box during the hackathon, then replace with a measured number.

## 7. Docker + GPU specifics

- **Host:** `nvidia-container-toolkit` 1.20.2-1 (apt, pinned), `sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker` **[measured, NVIDIA install guide]**. In WSL2: Windows driver only, never install a Linux driver inside WSL **[measured, NVIDIA WSL guide]**; Docker Desktop (WSL2 backend) or docker-ce inside Ubuntu both work with the toolkit.
- **Compose GPU override** (`compose.gpu.yml`): `deploy.resources.reservations.devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]`. Base `compose.yml` has no GPU → CPU profile is the default, satisfies "runs on a laptop/CPU".
- **Base images (pinned, Docker Hub API 2026-11-21, compressed amd64):** `nvidia/cuda:12.8.1-runtime-ubuntu24.04` 2.16 GB; `nvidia/cuda:12.6.3-runtime-ubuntu22.04` 1.53 GB; `nvidia/cuda:13.0.1-runtime-ubuntu24.04` 1.65 GB; `python:3.14-slim` 44 MB; `ollama/ollama:0.40.17` 3.4 GB. NVIDIA removed the `latest` tag and deletes tags 6 months after driver EOL **[reported, NGC]** → pin and mirror to GHCR in our org.
- **Prebuilt llama.cpp:** `ghcr.io/ggml-org/llama.cpp:server-cuda-b<build>` (CUDA 12.8.1 runtime base, built with `CUDA_DOCKER_ARCH=default`) and `:server-b<build>` CPU (amd64 + arm64) **[measured, docker.md + cuda.Dockerfile]**. Verify sm_75 on the 1660 Ti first run; if "no kernel image for device", build with `CUDA_DOCKER_ARCH=75` **[guess]**. Use `-b<build>` tags, never the floating alias.
- **Non-root:** `RUN useradd -m -u 1000 app` + `USER app`; the toolkit injects `/dev/nvidia*` with world-rw perms so no extra groups needed. Writable paths: `HF_HOME=/models/hf`, `XDG_CACHE_HOME=/tmp`. Mount weights `./models:/models:ro` with uid 1000 ownership on the host; download via `make models` (SHA256 in manifest), not inside the image → app image stays < 300 MB on CPU profile.
- **CUDA/driver:** 12.x images need driver ≥ 525 (minor-version compat) **[reported]**; CUDA 13 images need ≥ 580 → stay on 12.8 for the 1660 Ti and RunPod.
- **Apple Silicon:** Docker Desktop runs a Linux VM, Metal is not passed through; containers are CPU-only **[measured, Docker docs/Model Runner]**. Options: (a) `llama-server` native on host, app container reaches it at `http://host.docker.internal:8080` (document this in README as the "macOS accelerated mode"); (b) accept CPU-only inside Docker (4B model, ~10 t/s). Docker Model Runner gets Metal by running the engine on the host, same idea as (a).
- **Turing specifics:** no bf16 → `--dtype float16` in vLLM/transformers, `torch_dtype=torch.float16`; bitsandbytes NF4 OK, LLM.int8 OK (cc 7.5) **[measured, bnb docs]**; vLLM bnb backend requires cc ≥ 7.5 → 1660 Ti is exactly at the floor **[measured, vLLM docs]**.

## 8. Gotchas

- 1660 Ti pp is slow (no tensor cores): a 16-page form ≈ 20k tokens ≈ 2+ min prefill before any output. Chunk per page and cache the system prompt (`--cache-prompt`, same prefix).
- M4 Air is fanless: 15–40 % slowdown after 6–30 min **[reported, conflicting]**; run the big form early in the pitch, not after a 10-min warm-up on other files.
- Colab: tunnelling is a ToS grey zone on free tier; never tie the pitch to it.
- RunPod Community pods can be reclaimed; use Secure Cloud for the demo box.
- Vast.ai public ports are random and "not guaranteed", shared IPs → not for a URL you put on a slide.
- WSL2: `cudaHostRegister` fails, managed memory slow, throughput can degrade over days; reboot before demo.
- Hetzner GEX45 setup fee €209 and provisioning up to a day — pitch anchor only.
- PaddleOCR-VL paper VRAM numbers (11.9 GB on RTX 3060) are vLLM pre-allocation, not model need (~2 GB) **[measured, paper]**.

## 9. Evidence

- llama.cpp Apple Silicon table (#4167): M4 10-GPU 120 GB/s, Llama 2 7B Q4_0: pp512 221.3, tg128 24.1 t/s; build 8e672ef — https://github.com/ggml-org/llama.cpp/discussions/4167 **[measured]**
- llama.cpp CUDA table (#15013): T4 1219/46.4; GTX 1660 149/41.4; RTX 2060S 1420/60; A5000 4028/130; 3090 5175/158; 4090 11993/186; A10G 2354/108; RTX A4000 Ada 2780/61.8; RTX 2000 Ada 1956/50.6 (Q4_0 7B) — https://github.com/ggml-org/llama.cpp/discussions/15013 **[measured]**
- Colab FAQ (disallowed uses, 12 h / 24 h caps) — https://research.google.com/colaboratory/faq.html **[measured]**; Colab Pro $9.99/100 CU, CU burn rates — https://mccormickml.com/2024/04/23/colab-gpus-features-and-pricing/ , https://gpuperhour.com/blog/google-colab-alternatives **[reported]**
- Cloudflare quick tunnels limits — https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/ **[measured]**
- RunPod pricing (pods, storage, per-second billing) — https://www.runpod.io/pricing **[measured]**; ports/templates — https://docs.runpod.io/pods/configuration/expose-ports , https://docs.runpod.io/pods/templates/create-custom-template **[measured]**
- Vast.ai networking (`-p`, random external ports, shared IP) — https://docs.vast.ai/guides/instances/connect/networking **[measured]**; prices — https://markaicode.com/pricing/vast-ai-pricing/ **[reported]**
- Hetzner GEX45 — https://www.hetzner.com/dedicated-rootserver/gex45/ **[measured]**; OVH L4/L40S — https://www.ovhcloud.com/en-ie/public-cloud/prices/ **[reported]**; Lambda — https://lambda.ai/instances **[reported]**
- NVIDIA L4 spec 72 W, 24 GB, 300 GB/s — https://www.nvidia.com/en-us/data-center/l4/ **[measured]**
- bitsandbytes requirements (NF4 cc ≥ 6.0, int8 cc ≥ 7.5) — https://huggingface.co/docs/bitsandbytes/main/installation **[measured]**; vLLM bnb cc ≥ 7.5 — https://docs.vllm.ai/projects/vllm-omni/en/stable/user_guide/quantization/bitsandbytes/ **[measured]**
- NVIDIA Container Toolkit install — https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html **[measured]**; CUDA on WSL limits — https://docs.nvidia.com/cuda/archive/12.2.0/wsl-user-guide/index.html **[measured]**
- nvidia/cuda tags policy — https://catalog.ngc.nvidia.com/orgs/nvidia/containers/cuda **[reported]**; image sizes from Docker Hub API 2026-11-21 **[measured]**
- llama.cpp Docker images and CUDA Dockerfile — https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md , https://github.com/ggml-org/llama.cpp/blob/master/.devops/cuda.Dockerfile **[measured]**
- Docker on macOS, no Metal in containers; Model Runner runs engine on host — https://docs.docker.com/ai/model-runner/inference-engines/ , https://github.com/ggml-org/llama.cpp/discussions/12985 **[measured/reported]**
- Unlimited-OCR card: 3B bf16, MIT, vLLM/SGLang/transformers, GGUF links — https://huggingface.co/baidu/Unlimited-OCR **[measured]**; PaddleOCR-VL paper Table A2 (A10 0.74 p/s 15.6 GB, 4090D 1.15 p/s, 3060 0.36 p/s) — https://arxiv.org/abs/2510.14528 **[measured]**; DeepSeek-OCR ≥ 16 GB, 200k pages/day on A100-40G — https://arxiv.org/abs/2510.18234 **[reported]**
- Polish electricity 2026 G11 ≈ 1.04 zł/kWh gross — https://rankomat.pl/nieruchomosci/ceny-pradu **[measured]**; C11 offers 0.44–0.49 zł/kWh net — https://akademia-fotowoltaiki.pl/oszczedzanie-energii/prad-firmy/ **[reported]**
- CPU llama.cpp i7 DDR4 ~8 t/s 7B Q4; thread-count cliff at 12 threads on 6c/12t — https://insiderllm.com/guides/cpu-only-llms-what-actually-works/ , https://inventivehq.com/blog/cpu-thread-scaling-llm-inference **[reported]**
- M4 Air thermal throttling — https://craftrigs.pages.dev/guides/macbook-air-m4-thermal-throttling-30min-test/ , https://modelfit.io/blog/macbook-air-vs-pro-llm/ **[reported, conflicting]**

## 10. Next step (30-minute spike)

```bash
# M4 (native, Metal): measure pp/tg for 4B and 8B, decide model per machine
brew install llama.cpp
llama-bench -m models/qwen3-8b-q4_k_m.gguf -ngl 99 -p 512,4096 -n 128 -fa 1
llama-bench -m models/qwen3-4b-q4_k_m.gguf -ngl 99 -p 512,4096 -n 128 -fa 1
llama-server -m models/qwen3-8b-q4_k_m.gguf -ngl 99 -c 8192 -fa on --port 8080   # app in Docker -> host.docker.internal:8080

# Legion (WSL2): prove GPU in Docker + Turing fit
sudo apt-get install -y nvidia-container-toolkit=1.20.2-1 && sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.8.1-runtime-ubuntu24.04 nvidia-smi
docker run --rm --gpus all -v $PWD/models:/models:ro ghcr.io/ggml-org/llama.cpp:server-cuda \
  llama-bench -m /models/qwen3-8b-q4_k_m.gguf -ngl 99 -c 4096 -ctk q8_0 -p 512,4096 -n 128   # watch VRAM; if OOM use -ngl 28

# RunPod: Secure Cloud, RTX A5000, 50 GB volume at /workspace, expose HTTP 8000, image = our GHCR app image
# then: docker compose -f compose.yml -f compose.gpu.yml up; time a 1-page and a 16-page form; record forms/h for §6
```
