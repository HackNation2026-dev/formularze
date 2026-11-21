#!/usr/bin/env bash
# Our own "cloud": the open model (Qwen3.5-4B, Apache-2.0) on a GPU box we control, exposed over HTTPS with an
# API key. Mentor ruling (Discord 2026-11-21): a cloud-hosted model is allowed when it is open and self-hostable.
# Requires on the box: our CUDA llama.cpp build (see docs/08-implementacja/research/spikes/ocr-legion-spike.md),
# the GGUF in ~/ocr-bench, Docker. Prints the public URL; the key is in ~/ocr-bench/llm_api_key.txt (never in git).
# usage (on the box): scripts/legion/serve_gpu.sh [Qwen3.5-4B-Q4_K_M.gguf]
set -euo pipefail
cd ~/ocr-bench
MODEL="${1:-Qwen3.5-4B-Q4_K_M.gguf}"
[ -f llm_api_key.txt ] || { openssl rand -hex 24 > llm_api_key.txt; chmod 600 llm_api_key.txt; }
KEY=$(cat llm_api_key.txt)
docker rm -f llmsrv cfl >/dev/null 2>&1 || true
docker run -d --name llmsrv --restart unless-stopped \
  --device /dev/dxg -v /usr/lib/wsl:/usr/lib/wsl:ro -e LD_LIBRARY_PATH=/usr/lib/wsl/lib:/usr/local/cuda/lib64:/src/build/bin \
  -p 18081:8080 -v "$HOME/ocr-bench:/work" -v "$HOME/llama.cpp:/src" \
  --entrypoint /src/build/bin/llama-server nvidia/cuda:12.6.3-devel-ubuntu24.04 \
  -m "/work/$MODEL" --host 0.0.0.0 --port 8080 -ngl 99 -c 32768 --jinja --reasoning-budget 0 --temp 0 \
  --flash-attn on --cache-prompt --no-webui --api-key "$KEY" -np 4 >/dev/null
for i in $(seq 1 120); do curl -sf localhost:18081/health >/dev/null && break; sleep 1; done
curl -sf localhost:18081/health >/dev/null || { echo "llama-server did not come up"; exit 1; }
docker run -d --name cfl --restart unless-stopped --network host cloudflare/cloudflared:2025.11.1 \
  tunnel --url http://localhost:18081 --no-autoupdate >/dev/null
for i in $(seq 1 30); do URL=$(docker logs cfl 2>&1 | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" | head -1); [ -n "$URL" ] && break; sleep 1; done
echo "LLM_BASE_URL=$URL"
echo "LLM_API_KEY=<see ~/ocr-bench/llm_api_key.txt>"
echo "LLM_MODEL=qwen3.5-4b"
