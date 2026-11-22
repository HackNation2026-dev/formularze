#!/usr/bin/env python3
"""Buduje design/tokens.json (kolekcje Theme i Scale) z design/tokens.css.

tokens.css to eksport zmiennych FigCraft (Tailwind v4). Uruchom po każdym nowym eksporcie:
    python3 scripts/gui_tokens_from_css.py
"""

import json
import re
from pathlib import Path

DESIGN = Path(__file__).resolve().parents[1] / "design"


def _block(css: str, header: str) -> str:
    start = css.index(header)
    return css[start : css.index("}", start)]


def _rgb(hex_color: str) -> dict[str, float]:
    h = hex_color.lstrip("#")
    return {"r": int(h[0:2], 16) / 255, "g": int(h[2:4], 16) / 255, "b": int(h[4:6], 16) / 255, "a": 1.0}


def build(css: str) -> dict:
    colors = r"--color-([a-z-]+): (#[0-9A-Fa-f]{6});"
    light = dict(re.findall(colors, _block(css, "@theme static")))
    dark = dict(re.findall(colors, _block(css, '[data-theme="Dark"]')))
    scale = re.findall(r"--((?:space|radius)-[a-z0-9]+): (\d+)px;", css)

    theme_id, scale_id = "VariableCollectionId:1", "VariableCollectionId:3"
    collections = {
        theme_id: {
            "id": theme_id,
            "name": "Theme",
            "defaultModeId": f"{theme_id}/mode1",
            "modes": [
                {"modeId": f"{theme_id}/mode1", "name": "Light"},
                {"modeId": f"{theme_id}/mode2", "name": "Dark"},
            ],
        },
        scale_id: {
            "id": scale_id,
            "name": "Scale",
            "defaultModeId": f"{scale_id}/mode1",
            "modes": [{"modeId": f"{scale_id}/mode1", "name": "Mode 1"}],
        },
    }
    variables: dict[str, dict] = {}
    for i, name in enumerate(light, 1):
        vid = f"VariableID:{i}"
        variables[vid] = {
            "id": vid,
            "name": f"color/{name}",
            "resolvedType": "COLOR",
            "variableCollectionId": theme_id,
            "valuesByMode": {f"{theme_id}/mode1": _rgb(light[name]), f"{theme_id}/mode2": _rgb(dark[name])},
        }
    for j, (name, px) in enumerate(scale, len(light) + 1):
        vid = f"VariableID:{j}"
        variables[vid] = {
            "id": vid,
            "name": name.replace("-", "/", 1),
            "resolvedType": "FLOAT",
            "variableCollectionId": scale_id,
            "valuesByMode": {f"{scale_id}/mode1": int(px)},
        }
    return {"meta": {"variableCollections": collections, "variables": variables}}


def main() -> None:
    data = build((DESIGN / "tokens.css").read_text(encoding="utf-8"))
    (DESIGN / "tokens.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
