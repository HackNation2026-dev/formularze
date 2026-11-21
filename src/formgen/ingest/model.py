"""Format-independent document model produced by the ingest parsers and consumed by extraction."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

ENUM_RE = re.compile(r"^\s*(\d{1,2}[\)\.]|[a-z]\))\s+\S")
FILL_ONLY_RE = re.compile(r"^[\s_.,…☐-]*$")
FILL_RE = re.compile(r"(\.\s?){4,}|…{2,}|_{4,}|(\.…)+|(…\.)+")
BOX_CHARS = "□☐☑■▢◻✓✗"


@dataclass
class Line:
    text: str
    top: float = 0.0
    x0: float = 0.0
    size: float = 0.0
    bold: bool = False
    checkboxes: int = 0  # number of ☐ markers in text

    @property
    def is_heading(self) -> bool:
        t = self.text.strip()
        if not t or len(t) > 120:
            return False
        if self.bold and len(t.split()) <= 14:
            return True
        letters = [c for c in t if c.isalpha()]
        return bool(letters) and sum(c.isupper() for c in letters) / len(letters) > 0.85 and len(t) > 3

    @property
    def has_fill(self) -> bool:
        return "____" in self.text


@dataclass
class Table:
    rows: list[list[str]]
    top: float = 0.0


@dataclass
class Page:
    number: int
    lines: list[Line] = field(default_factory=list)
    tables: list[Table] = field(default_factory=list)
    width: float = 0.0
    height: float = 0.0


@dataclass
class Document:
    pages: list[Page]
    source_kind: str = ""
    ocr: bool = False

    @property
    def text(self) -> str:
        return "\n".join(ln.text for p in self.pages for ln in p.lines)

    def to_prompt_text(self, page_numbers: list[int] | None = None) -> str:
        """Layout-aware plain text for the LLM: headings as '## ', fills as '____', boxes as '☐', tables as rows."""
        out: list[str] = []
        for p in self.pages:
            if page_numbers and p.number not in page_numbers:
                continue
            out.append(f"=== strona {p.number} ===")
            items: list[tuple[float, str]] = []
            prev_prompt = False  # previous line ended with ':' -> numbered items below are choices
            for ln in p.lines:
                t = normalise(ln.text)
                if not t:
                    continue
                if prev_prompt and ENUM_RE.match(t) and "☐" not in t:
                    t = "☐ " + t
                elif not ENUM_RE.match(t) and not FILL_ONLY_RE.match(t):
                    prev_prompt = t.rstrip().endswith(":") and not ln.is_heading
                items.append((ln.top, f"## {t}" if ln.is_heading else t))
            for tb in p.tables:
                rows = [" | ".join(normalise(c) for c in r) for r in tb.rows if any(c.strip() for c in r)]
                if rows:
                    items.append((tb.top, "[tabela]\n" + "\n".join(rows) + "\n[/tabela]"))
            items.sort(key=lambda x: x[0])
            out.extend(s for _, s in items)
        return "\n".join(out)


def normalise(text: str) -> str:
    t = FILL_RE.sub(" ____ ", text)
    for c in BOX_CHARS:
        t = t.replace(c, "☐" if c in "□☐▢◻" else "☑")
    # Symbol / Wingdings private-use glyphs (radio circles, boxes) -> choice marker
    t = "".join("☐" if 0xF000 <= ord(ch) <= 0xF0FF else ch for ch in t)
    return re.sub(r"[ \t]{2,}", " ", t).strip()
