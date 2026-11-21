#!/usr/bin/env bash
# Fast evaluation loop on top of scripts/eval_suite.py. Three rules (team decision, 2026-11-22):
#  1. warm by default: the model endpoint is set to an unreachable address, so a run only reads cached answers;
#     a cache miss shows up as ERROR instead of silently spending GPU minutes. Use it for post-processing changes
#     (to_spec, assemble.py, validation). A prompt change needs --cold once to fill the cache.
#  2. smoke subset by default: 05 (reference), 09 (multi-person, hard), 04 (low score), 01 (reference; catches the
#     H6-style regression the first three hide). --full runs all 9 forms; do that once, cold, before a commit.
#  3. form 08 (multi-page tables) is never in the smoke subset.
# usage: scripts/eval_fast.sh [--cold] [--full] [extra eval_suite args]
#        LLM_BASE_URL / LLM_API_KEY are only used with --cold or --full. Cache: $EVAL_CACHE (default ~/.cache/formgen-eval)
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-.venv/bin/python}
export EVAL_CACHE=${EVAL_CACHE:-$HOME/.cache/formgen-eval}
export PYTHONPATH=src
cold=0; full=0; extra=()
for a in "$@"; do case "$a" in --cold) cold=1;; --full) full=1; cold=1;; *) extra+=("$a");; esac; done
only=(--only 05,09,04,01)
[ $full = 1 ] && only=()
if [ $cold = 0 ]; then export LLM_BASE_URL=http://127.0.0.1:9; fi
exec "$PY" scripts/eval_suite.py ${only[@]+"${only[@]}"} --workers 4 ${extra[@]+"${extra[@]}"}
