import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
GOLDEN_DIR = ROOT / "data" / "input" / "02_przyklady_json"
GOLDENS = sorted(p for p in GOLDEN_DIR.glob("*.json") if "Schemat" not in p.name)


@pytest.fixture(params=GOLDENS, ids=[p.stem for p in GOLDENS])
def golden_path(request) -> Path:
    return request.param


@pytest.fixture
def golden_dict(golden_path) -> dict:
    return json.loads(golden_path.read_text(encoding="utf-8"))
