#!/usr/bin/env bash
# A/B of model sizes on CPU only: starts llama.cpp (CPU image) for each GGUF on the remote x86 box,
# scores both golden forms and times forms 05 + 08. Results in docs/08-implementacja/research/ab-models-cpu.md.
# usage: scripts/ab_models_cpu.sh   (needs: ssh legion, Tailscale IP, PY venv)
set -uo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-/Users/mateuszkin/.t3/projects/hacknation-cyfr-forumla/.venv/bin/python}
HOST=legion; IP=100.111.226.49; PORT=18082; THREADS=${THREADS:-6}   # physical cores; HT threads slow llama.cpp down
OUT=docs/08-implementacja/research/ab-models-cpu.md
MODELS=(
  "unsloth/Qwen3.5-2B-GGUF   Qwen3.5-2B-Q4_K_M.gguf"
  "unsloth/Qwen3.5-4B-GGUF   Qwen3.5-4B-Q4_K_M.gguf"
)
G05="data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF"
G01="data/input/01_przyklady_formularze/01_numer_porzadkowy_nieruchomosci/Wniosek o ustalenie numeru porządkowego nieruchomości.pdf"
{
  echo "---"; echo "wersja: 0.4.0"; echo "aktualizacja: $(date +%F)"; echo "status: pomiar"; echo "---"; echo
  echo "# A/B rozmiaru modelu na samym CPU (x86, i7-9750H, 6 rdzeni, llama.cpp server-b12602, nic innego na maszynie)"; echo
  echo "Pytanie: czy mniejszy model wystarcza, skoro kompilator i walidator robią większość pracy. Jury może nie mieć GPU."; echo
  echo "| Model | Plik | Golden 05 composite / recall / czas | Golden 01 composite / recall / czas | Formularz 08 (6 str.) czas | Błędy reguł |"
  echo "|---|---|---|---|---|---|"
} > "$OUT"
for entry in "${MODELS[@]}"; do
  read -r repo file <<<"$entry"
  echo "=== $file" >&2
  ssh -o BatchMode=yes $HOST "bash -lc 'cd ~/ocr-bench && [ -f $file ] || curl -sL -o $file https://huggingface.co/$repo/resolve/main/$file; docker rm -f cpusrv >/dev/null 2>&1; docker run -d --name cpusrv -p $PORT:8080 -v \$HOME/ocr-bench:/models:ro ghcr.io/ggml-org/llama.cpp:server-b12602 -m /models/$file --host 0.0.0.0 --port 8080 -c 16384 --jinja --reasoning-budget 0 --temp 0 -t $THREADS --no-webui >/dev/null; for i in \$(seq 1 180); do curl -sf localhost:$PORT/health >/dev/null && break; sleep 2; done; curl -s localhost:$PORT/health'" >&2
  export LLM_BASE_URL=http://$IP:$PORT PYTHONPATH=src
  row="| ${file%%-Q*} | $file"
  for g in 05 01; do
    if [ $g = 05 ]; then f="$G05"; gj=data/input/02_przyklady_json/05_nadplata_podatku.json; else f="$G01"; gj=data/input/02_przyklady_json/01_numer_porzadkowy_nieruchomosci.json; fi
    t0=$(date +%s)
    log=$($PY scripts/run_e2e.py "$f" "$gj" 2>&1)
    dt=$(( $(date +%s) - t0 ))
    comp=$(echo "$log" | grep -oE "composite=[0-9.]+" | head -1 | cut -d= -f2)
    rec=$(echo "$log" | grep -oE " R=[0-9.]+" | head -1 | tr -d ' R=')
    errs=$(echo "$log" | grep -E "^rule errors" | head -1 | cut -c14-40)
    row="$row | ${comp:-ERR} / ${rec:-?} / ${dt}s"
    [ $g = 05 ] && e05="$errs"
  done
  t0=$(date +%s); $PY scripts/batch.py --only 08 --out /tmp/ab_out >/dev/null 2>&1; dt=$(( $(date +%s) - t0 ))
  row="$row | ${dt}s | ${e05:-?} |"
  echo "$row" >> "$OUT"; echo "$row" >&2
done
ssh -o BatchMode=yes $HOST "docker rm -f cpusrv >/dev/null 2>&1" 
{ echo; echo "Czas = cały pipeline łącznie z parsowaniem, mierzony z MacBooka przez Tailscale (narzut sieci pomijalny). Golden = plik referencyjny organizatora; composite i recall z src/formgen/eval/metric.py."; } >> "$OUT"
echo "DONE -> $OUT" >&2
