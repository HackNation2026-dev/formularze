---
wersja: 0.4.0
aktualizacja: 2026-11-22
status: implementacja
---

# Ustawienie na obronę

Maszyna jury: x86, bez GPU (mentor, 21.11). Model w chmurze dozwolony, jeśli otwarty i możliwy do postawienia u siebie (mentor, 21.11).

## Układ
- **Model (nasza „chmura”):** Qwen3.5-4B Q4_K_M (Apache-2.0) na naszym komputerze z GPU (GTX 1660 Ti), llama.cpp z CUDA (ok. 59 tok/s generowania; na CPU ok. 11 tok/s), klucz API, tunel HTTPS Cloudflare. Start: `scripts/legion/serve_gpu.sh` na tej maszynie. Wypisuje `LLM_BASE_URL`. Klucz leży w `~/ocr-bench/llm_api_key.txt` na tej maszynie, nigdy w repo.
- **Aplikacja na maszynie jury:** `docker compose up` z `.env`, w którym `LLM_BASE_URL` to adres tunelu, `LLM_API_KEY` to klucz, `LLM_FALLBACK_BASE_URL=http://llm:8080` (lokalny kontener llama.cpp na CPU jako zapas).
- **Zapas 1:** brak sieci -> klient po pierwszym błędzie przechodzi na lokalny llama.cpp (CPU, 4B): prosty formularz 1–4 min.
- **Zapas 2:** lokalny model też padnie -> ekstraktor heurystyczny, JSON nadal poprawny. Nagłówek `X-Extractor` pokazuje, która ścieżka zadziałała.

## Pomiar (21.11, przez tunel, z innej sieci)
- Golden 05: 22,7 s cały pipeline, composite 0,92, 0 błędów reguł.
- Bez klucza endpoint odpowiada 401. `/health` jest publiczne (tylko status).

## Pomiar (22.11, x86 bez GPU)
- `scripts/verify_stack.sh` na backendzie `d3f0b65`, i7-9750H, tylko CPU: 14/14 PASS; analiza formularza 05 przez lokalny LLM 85 s.
- Seria pomiarów formularza 05 na CPU: 207 s -> 122 s po PR #48 (checkpointy), #49 (warm-up), #52 (`LLM_PARALLEL=2`).

## Przed obroną
1. Na maszynie z GPU: `scripts/legion/serve_gpu.sh`, zapisać nowy adres (tunel bez konta zmienia adres po restarcie).
2. Na maszynie jury: `.env` z `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_FALLBACK_BASE_URL=http://llm:8080`; `make models` (albo wagi z pendrive do `models/`); `docker compose build && docker compose up -d`; `scripts/verify_stack.sh`.
3. Sprawdzić `curl -s $LLM_BASE_URL/health` z sieci sali.
4. Pokazać na slajdzie: ten sam otwarty model lokalnie w Dockerze i w chmurze, jeden przełącznik `LLM_BASE_URL`.

## Ryzyka
- Darmowy tunel `trycloudflare.com` zrywa żądanie po 100 s (HTTP 524). Pojedynczy formularz na obronie mieści się w limicie (2 wywołania równolegle, GPU ok. 25 tok/s na slot), ale długi fragment (formularz 06, 09) albo kilka formularzy naraz może go przekroczyć. Wtedy klient przechodzi na lokalny model CPU (zapas 1). Wsady generujemy po Tailscale (`http://100.111.226.49:18081`), nie przez tunel. Pomiar 22.11: wsad 2 x 2 wywołania przez tunel dał 524 na jednym fragmencie.
- Komputer z GPU musi być włączony i online przez całą obronę; łącze w górę bez znaczenia (ruch to kilobajty).
- Adres `trycloudflare.com` jest losowy i bez gwarancji dostępności. Jeśli zespół ma konto Cloudflare albo ngrok, lepszy stały adres.
- 6 GB VRAM mieści tylko model 4B. Większy model (9B, Bielik 11B) wymagałby karty z 12+ GB, np. RunPod A5000 (~1,3 zł/h), ten sam skrypt z innym obrazem.
