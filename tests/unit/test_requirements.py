"""Every third-party module imported by src/ must be pinned in requirements.txt (the Docker image installs only that).

Regression guard: httpx was a dev-only dependency, so the container failed with ModuleNotFoundError at runtime.
"""

import ast
import sys
from pathlib import Path

from tests.conftest import ROOT

# import name -> distribution name in requirements.txt (only where they differ)
DIST = {
    "jwt": "pyjwt",
    "docx": "python-docx",
    "magic": "python-magic",
    "PIL": "pillow",
    "rapidfuzz": "rapidfuzz",
    "jsonata": "jsonata-python",
    "pydantic_settings": "pydantic-settings",
    "multipart": "python-multipart",
    "odf": "odfpy",
    "pypdfium2": "pypdfium2",
    "uvicorn": "uvicorn",
}


def _imports() -> set[str]:
    names: set[str] = set()
    for path in (ROOT / "src").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                names.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                names.add(node.module.split(".")[0])
    return {n for n in names if n not in sys.stdlib_module_names and n != "formgen"}


def _pinned() -> set[str]:
    out = set()
    for line in (ROOT / "requirements.txt").read_text().splitlines():
        line = line.split("#")[0].strip()
        if line:
            out.add(line.split("==")[0].split("[")[0].strip().lower())
    return out


def test_every_runtime_import_is_pinned():
    pinned = _pinned()
    missing = sorted(n for n in _imports() if DIST.get(n, n).lower() not in pinned)
    assert missing == [], f"add to requirements.txt: {missing}"
