"""Kontrola tokenów makiet GUI (design/tokens.json, eksport zmiennych FigCraft)."""

import json
from pathlib import Path

import pytest

TOKENS = Path(__file__).resolve().parents[1] / "design" / "tokens.json"
NAMES = [
    "background",
    "surface",
    "border",
    "border-strong",
    "text",
    "muted",
    "primary",
    "primary-foreground",
    "success",
    "warning",
    "danger",
    "info",
]


def _load() -> dict[str, dict[str, str]]:
    """Zwraca {nazwa tokenu: {tryb: #RRGGBB}} dla kolekcji Theme."""
    data = json.loads(TOKENS.read_text(encoding="utf-8"))
    meta = data.get("meta", data)
    collections = meta["variableCollections"]
    theme = next(c for c in collections.values() if c["name"] == "Theme")
    modes = {m["modeId"]: m["name"] for m in theme["modes"]}
    out: dict[str, dict[str, str]] = {}
    for var in meta["variables"].values():
        if var["variableCollectionId"] != theme["id"]:
            continue
        name = var["name"].removeprefix("color/")
        out[name] = {modes[mid]: _hex(val) for mid, val in var["valuesByMode"].items()}
    return out


def _hex(value: dict | str) -> str:
    if isinstance(value, str):
        return value.upper()
    to = lambda x: round(x * 255)  # noqa: E731
    return f"#{to(value['r']):02X}{to(value['g']):02X}{to(value['b']):02X}"


def _lum(color: str) -> float:
    def channel(i: int) -> float:
        c = int(color[1 + 2 * i : 3 + 2 * i], 16) / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)


def contrast(a: str, b: str) -> float:
    hi, lo = sorted((_lum(a), _lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def test_contrast_helper_known_values():
    assert contrast("#000000", "#FFFFFF") == pytest.approx(21.0)
    assert contrast("#777777", "#777777") == pytest.approx(1.0)


def test_tokens_have_both_modes():
    tokens = _load()
    for name in NAMES:
        assert set(tokens[name]) == {"Light", "Dark"}, name


@pytest.mark.parametrize("mode", ["Light", "Dark"])
def test_contrast_aa(mode):
    t = {n: v[mode] for n, v in _load().items()}
    pairs = [
        ("text", "background"),
        ("text", "surface"),
        ("muted", "surface"),
        ("muted", "background"),
        ("primary-foreground", "primary"),
        ("primary", "surface"),
        ("success", "surface"),
        ("warning", "surface"),
        ("danger", "surface"),
        ("info", "surface"),
    ]
    for fg, bg in pairs:
        assert contrast(t[fg], t[bg]) >= 4.5, (mode, fg, bg, contrast(t[fg], t[bg]))
    assert contrast(t["border-strong"], t["surface"]) >= 3.0  # obrys pola (WCAG 1.4.11)
    assert contrast(t["border"], t["surface"]) >= 1.3  # separator dekoracyjny


def test_primary_light_is_brief_accent():
    assert _load()["primary"]["Light"] == "#0052A5"


CSS = TOKENS.with_name("tokens.css")


def _css_block(text: str, header: str) -> str:
    start = text.index(header)
    return text[start : text.index("}", start)]


def test_css_matches_json_colors():
    import re

    css = CSS.read_text(encoding="utf-8")
    light = dict(re.findall(r"--color-([a-z-]+): (#[0-9A-Fa-f]{6});", _css_block(css, "@theme static")))
    dark = dict(re.findall(r"--color-([a-z-]+): (#[0-9A-Fa-f]{6});", _css_block(css, '[data-theme="Dark"]')))
    tokens = _load()
    for name in NAMES:
        assert tokens[name]["Light"] == light[name].upper(), name
        assert tokens[name]["Dark"] == dark[name].upper(), name


def test_scale_tokens_in_json():
    import re

    data = json.loads(TOKENS.read_text(encoding="utf-8"))["meta"]
    scale = next(c for c in data["variableCollections"].values() if c["name"] == "Scale")
    mode = scale["modes"][0]["modeId"]
    values = {
        v["name"]: v["valuesByMode"][mode]
        for v in data["variables"].values()
        if v["variableCollectionId"] == scale["id"]
    }
    css = CSS.read_text(encoding="utf-8")
    for name, px in re.findall(r"--((?:space|radius)-[a-z0-9]+): (\d+)px;", css):
        assert values[name.replace("-", "/", 1)] == int(px), name
    assert {"space/1", "space/8", "radius/sm", "radius/md", "radius/lg"} <= set(values)


@pytest.mark.parametrize("mode", ["Light", "Dark"])
def test_status_colors_on_background(mode):
    t = {n: v[mode] for n, v in _load().items()}
    for fg in ("success", "warning", "danger", "info"):
        assert contrast(t[fg], t["background"]) >= 4.5, (mode, fg, contrast(t[fg], t["background"]))
