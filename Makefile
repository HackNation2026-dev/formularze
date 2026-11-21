PY=.venv/bin/python
MODEL=models/Qwen3.5-4B-Q4_K_M.gguf

.PHONY: venv test lint run llm e2e batch models docker

venv:
	/opt/homebrew/bin/python3.14 -m venv .venv && .venv/bin/pip install -e ".[dev]"

test:
	$(PY) -m pytest -q

lint:
	.venv/bin/ruff check src tests scripts && .venv/bin/ruff format --check src tests scripts

run:            ## API on :8000 (AUTH_ENABLED=false for a quick demo)
	AUTH_ENABLED=false $(PY) -m formgen

llm:            ## local llama.cpp server on :8080 (Metal)
	scripts/llm_server.sh $(MODEL) 8080

e2e:            ## one reference form through the LLM pipeline, scored against its golden JSON
	$(PY) scripts/run_e2e.py "data/input/01_przyklady_formularze/05_nadplata_podatku/Wniosek o stwierdzenie nadpłaty podatku.PDF" data/input/02_przyklady_json/05_nadplata_podatku.json --out data/output/05_nadplata_podatku.json

batch:          ## all 7 evaluation forms -> data/output/*.json
	$(PY) scripts/batch.py

models:         ## download the LLM weights (2.7 GB, Apache-2.0) into ./models
	$(PY) -c "from huggingface_hub import hf_hub_download as d; print(d('unsloth/Qwen3.5-4B-GGUF','Qwen3.5-4B-Q4_K_M.gguf',local_dir='models'))"

docker:
	docker compose build
