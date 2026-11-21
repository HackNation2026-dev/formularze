#!/usr/bin/env bash
# Start a local llama.cpp server for development (Metal on macOS, CUDA on Linux when built with it).
# usage: scripts/llm_server.sh [model.gguf] [port]
set -euo pipefail
MODEL="${1:-models/Qwen3.5-4B-Q4_K_M.gguf}"
PORT="${2:-8080}"
exec llama-server -m "$MODEL" --host 127.0.0.1 --port "$PORT" \
  --ctx-size 16384 --jinja --reasoning-budget 0 --temp 0.1 \
  -ngl 99 --flash-attn on --cache-prompt --no-webui
