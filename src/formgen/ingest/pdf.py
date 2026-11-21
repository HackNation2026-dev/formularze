"""Text-layer PDF -> Document via pdfplumber (MIT) + pypdfium2 (Apache/BSD). No PyMuPDF (AGPL)."""

from __future__ import annotations

import io

import pdfplumber

from formgen.ingest.model import Document, Line, Page, Table

BOX_GLYPHS = set("□☐☑■▢◻")


def _is_bold(fontname: str) -> bool:
    f = fontname.lower()
    return "bold" in f or "black" in f or "heavy" in f or f.endswith(",b")


def _checkbox_rects(page) -> list[dict]:
    out = []
    for r in page.rects:
        w, h = r["width"], r["height"]
        if 5 <= w <= 16 and 5 <= h <= 16 and abs(w - h) <= 3:
            out.append(r)
    for c in page.chars:
        t = c["text"]
        if t in BOX_GLYPHS or (len(t) == 1 and 0xF000 <= ord(t) <= 0xF0FF and "wingding" in c["fontname"].lower()):
            out.append({"x0": c["x0"], "x1": c["x1"], "top": c["top"], "bottom": c["bottom"], "glyph": True})
    return out


def parse_pdf(data: bytes) -> Document:
    pages: list[Page] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            pg = Page(number=i, width=float(page.width), height=float(page.height))
            tables, table_bboxes = [], []
            try:
                page_area = float(page.width) * float(page.height)
                for t in page.find_tables():
                    bx0, by0, bx1, by1 = t.bbox
                    if (bx1 - bx0) * (by1 - by0) > 0.6 * page_area:
                        continue  # page-border grid, not a data table: keep its content as lines
                    rows = t.extract() or []
                    rows = [[(c or "").replace("\n", " ").strip() for c in r] for r in rows]
                    if sum(1 for r in rows for c in r if c) >= 4 and len(rows) >= 2:
                        tables.append(Table(rows=rows, top=float(t.bbox[1])))
                        table_bboxes.append(t.bbox)
            except Exception:
                pass
            boxes = _checkbox_rects(page)
            words = page.extract_words(keep_blank_chars=True, use_text_flow=False, extra_attrs=["fontname", "size"])
            # group words into lines by vertical position
            words.sort(key=lambda w: (round(w["top"] / 3), w["x0"]))
            lines: list[list[dict]] = []
            for w in words:
                if lines and abs(lines[-1][0]["top"] - w["top"]) <= 3:
                    lines[-1].append(w)
                else:
                    lines.append([w])
            for ws in lines:
                ws.sort(key=lambda w: w["x0"])
                top, bottom = min(w["top"] for w in ws), max(w["bottom"] for w in ws)
                if any(
                    bb[0] - 2 <= ws[0]["x0"] and ws[-1]["x1"] <= bb[2] + 2 and bb[1] - 2 <= top and bottom <= bb[3] + 2
                    for bb in table_bboxes
                ):
                    continue  # inside a detected table
                line_boxes = [b for b in boxes if b["top"] < bottom and b["bottom"] > top and not b.get("glyph")]
                parts: list[str] = []
                used = set()
                for w in ws:
                    for j, b in enumerate(line_boxes):
                        if j not in used and b["x1"] - 3 <= w["x0"] <= b["x1"] + 14:
                            parts.append("☐")
                            used.add(j)
                    parts.append(w["text"])
                for j in range(len(line_boxes)):
                    if j not in used:
                        parts.insert(0, "☐")
                text = " ".join(parts)
                size = max(w["size"] for w in ws)
                bold = sum(_is_bold(w["fontname"]) for w in ws) >= max(1, len(ws) // 2)
                pg.lines.append(
                    Line(
                        text=text,
                        top=float(top),
                        x0=float(ws[0]["x0"]),
                        size=float(size),
                        bold=bold,
                        checkboxes=text.count("☐"),
                    )
                )
            pg.tables = tables
            pages.append(pg)
    return Document(pages=pages, source_kind="pdf")
