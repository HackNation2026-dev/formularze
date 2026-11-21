#!/usr/bin/env bash
# End-to-end check of the Docker deliverable (R-09..R-15, R-20): builds nothing, assumes `docker compose build`
# already ran and models/ holds the GGUF. Prints PASS/FAIL per check and exits non-zero on any failure.
# usage: scripts/verify_stack.sh [sample.pdf]
set -uo pipefail
cd "$(dirname "$0")/.."
SAMPLE="${1:-data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF}"
PORT="${APP_PORT:-8000}"
fails=0
check() { if eval "$2"; then echo "PASS  $1"; else echo "FAIL  $1"; fails=$((fails+1)); fi; }

[ -f "$SAMPLE" ] || python3 scripts/sync_materials.py >/dev/null
docker compose up -d >/dev/null 2>&1
for i in $(seq 1 120); do curl -sf "localhost:$PORT/health" >/dev/null && break; sleep 2; done
for i in $(seq 1 120); do docker compose exec -T api python -c "import urllib.request;urllib.request.urlopen('http://llm:8080/health',timeout=2)" 2>/dev/null && break; sleep 2; done

API=$(docker compose ps -q api)
check "api /health"                         "curl -sf localhost:$PORT/health | grep -q ok"
check "api runs as non-root uid 1000"       "[ \"\$(docker exec $API id -u)\" = 1000 ]"
check "api root filesystem read-only"       "[ \"\$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' $API)\" = true ]"
check "only api publishes a port"           "[ \"\$(docker compose ps --format '{{.Service}} {{.Publishers}}' | grep -c ':')\" -le 1 ]"
check "backend network is internal"         "[ \"\$(docker network inspect -f '{{.Internal}}' \$(docker compose ps -q llm | xargs docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}'))\" = true ]"
check "backend has no Internet route"       "! docker run --rm --network \$(docker compose ps -q llm | xargs docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}') python:3.14.4-slim-trixie python -c \"import urllib.request;urllib.request.urlopen('https://pypi.org',timeout=5)\" 2>/dev/null"
check "no :latest tags in compose/Dockerfile" "! grep -nE ':latest' compose.yaml Dockerfile"
check "no secret baked into image"          "! docker run --rm --entrypoint sh $(docker compose config --images | grep api) -c 'env | grep -q JWT_SECRET'"

TOKEN=$(docker compose exec -T api python -c "from formgen.api.security import issue_token;from formgen.api.settings import get_settings;print(issue_token(get_settings()))")
check "401 without token"                   "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -F file=@/etc/hostname localhost:$PORT/api/v1/forms/analyze)\" = 401 ]"
check "415 on MIME mismatch"                "printf 'not a pdf' > /tmp/fake.pdf && [ \"\$(curl -s -o /dev/null -w '%{http_code}' -H \"Authorization: Bearer $TOKEN\" -F file=@/tmp/fake.pdf localhost:$PORT/api/v1/forms/analyze)\" = 415 ]"
HDRS=$(mktemp); OUT=$(mktemp)
START=$(date +%s)
CODE=$(curl -s -D "$HDRS" -o "$OUT" -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -F "file=@$SAMPLE" "localhost:$PORT/api/v1/forms/analyze")
echo "      analyze: HTTP $CODE in $(( $(date +%s) - START ))s, $(grep -i '^x-extractor' "$HDRS" | tr -d '\r')"
check "analyze returns 200"                 "[ $CODE = 200 ]"
check "analyze used the LLM sidecar"        "grep -qi '^x-extractor: LlmExtractor' $HDRS"
check "result passes COI rules"             "curl -s -H \"Authorization: Bearer $TOKEN\" -H 'Content-Type: application/json' --data-binary @$OUT localhost:$PORT/api/v1/forms/validate | grep -q '\"valid\":true'"
check "api image works with --network none" "docker run --rm --network none -e EXTRACTOR=heuristic -e AUTH_ENABLED=false -v \"\$PWD/$SAMPLE\":/s.pdf:ro --entrypoint python $(docker compose config --images | grep api) -c \"from formgen import pipeline;from formgen.api.settings import Settings;r=pipeline.run(open('/s.pdf','rb').read(),'pdf','s.pdf',Settings());assert r.ok;print(len(r.form.tabs))\" >/dev/null"
echo "---"; [ $fails = 0 ] && echo "ALL PASS" || echo "$fails FAILED"
exit $fails
