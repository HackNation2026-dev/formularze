"""DOCX / XLSX / ODS / DOC -> Document. python-docx (MIT), openpyxl (MIT), odfpy (Apache), Tika sidecar for .doc."""

from __future__ import annotations

import io
import re
import zipfile
from xml.etree import ElementTree as ET

import docx
from docx.oxml.ns import qn
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph

from formgen.ingest.model import ENUM_RE, FILL_RE, Document, Line, Page, Table

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
WP = "{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}"
MC = "{http://schemas.openxmlformats.org/markup-compatibility/2006}"
EMU_PER_PT = 12700


# ---------------------------------------------------------------- DOCX
def parse_docx(data: bytes) -> Document:
    d = docx.Document(io.BytesIO(data))
    page = Page(number=1)
    pages = [page]
    y = 0.0
    for child in d.element.body.iterchildren():
        if child.tag == qn("w:p"):
            p = Paragraph(child, d)
            if child.findall(f".//{W}br[@{W}type='page']"):
                page = Page(number=len(pages) + 1)
                pages.append(page)
                y = 0.0
            t = p.text.strip()
            if t:
                style = (p.style.name if p.style is not None else "") or ""
                bold = style.lower().startswith("heading") or (
                    bool(p.runs) and all(r.bold for r in p.runs if r.text.strip())
                )
                size = max((r.font.size.pt for r in p.runs if r.font.size), default=11.0)
                page.lines.append(Line(text=t, top=y, size=size, bold=bold, checkboxes=t.count("☐") + t.count("□")))
                y += 12
        elif child.tag == qn("w:tbl"):
            tb = DocxTable(child, d)
            rows = []
            for r in tb.rows:
                cells, prev = [], None
                for c in r.cells:
                    if c._tc is prev:
                        continue
                    prev = c._tc
                    cells.append(c.text.replace("\n", " ").strip())
                rows.append(cells)
            page.tables.append(Table(rows=rows, top=y))
            y += 12 * max(1, len(rows))
    # PDF-converted DOCX: everything sits in absolutely positioned text boxes
    boxed = _anchored_textboxes(data)
    if boxed and sum(len(p.lines) for p in pages) < len(boxed) // 4:
        pages = _pages_from_boxes(boxed)
    return Document(pages=pages, source_kind="docx")


def _anchored_textboxes(data: bytes) -> list[tuple[int, float, float, str, bool, float]]:
    """(page_index, y_pt, x_pt, text, bold, size) for every wp:anchor text box in document order (mc:Choice only)."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    page_idx = -1
    body = root.find(f"{W}body")
    if body is None:
        return out
    # PDF->DOCX converters emit one top-level paragraph per page, each holding that page's anchored boxes
    for para in body.findall(f"{W}p"):
        anchors = list(para.iter(f"{WP}anchor"))
        if not anchors:
            continue
        page_idx += 1
        for anchor in anchors:
            posv = anchor.find(f"{WP}positionV/{WP}posOffset")
            posh = anchor.find(f"{WP}positionH/{WP}posOffset")
            y = int(posv.text) / EMU_PER_PT if posv is not None and posv.text else 0.0
            x = int(posh.text) / EMU_PER_PT if posh is not None and posh.text else 0.0
            for tb in anchor.iter(f"{W}txbxContent"):
                for p in tb.iter(f"{W}p"):
                    text = "".join(t.text or "" for t in p.iter(f"{W}t")).strip()
                    if not text:
                        continue
                    bold = any(
                        r.find(f"{W}rPr/{W}b") is not None and r.find(f"{W}rPr/{W}b").get(f"{W}val", "true") != "false"
                        for r in p.iter(f"{W}r")
                    )
                    sz = [int(s.get(f"{W}val")) / 2 for s in p.iter(f"{W}sz") if s.get(f"{W}val")]
                    out.append((page_idx, y, x, text, bold, max(sz) if sz else 11.0))
    # mc:Fallback duplicates the same boxes as VML v:shape (no wp:anchor), so they are already excluded.
    return out


def _pages_from_boxes(boxed) -> list[Page]:
    by_page: dict[int, list] = {}
    for pi, y, x, text, bold, size in boxed:
        by_page.setdefault(pi, []).append((y, x, text, bold, size))
    pages = []
    for pi in sorted(by_page):
        items = sorted(by_page[pi])
        page = Page(number=pi + 1)
        cur: list = []
        for it in items:
            if cur and abs(cur[-1][0] - it[0]) <= 4:
                cur.append(it)
            else:
                if cur:
                    page.lines.append(_merge(cur))
                cur = [it]
        if cur:
            page.lines.append(_merge(cur))
        pages.append(page)
    return pages


def _merge(items) -> Line:
    items.sort(key=lambda it: it[1])
    text = " ".join(it[2] for it in items)
    return Line(
        text=text,
        top=items[0][0],
        x0=items[0][1],
        size=max(it[4] for it in items),
        bold=all(it[3] for it in items),
        checkboxes=text.count("☐") + text.count("□"),
    )


# ---------------------------------------------------------------- XLSX
def parse_xlsx(data: bytes) -> Document:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=False)
    pages = []
    for n, ws in enumerate(wb.worksheets, start=1):
        page = Page(number=n)
        y = 0.0
        for row in ws.iter_rows():
            cells = [c for c in row if c.value not in (None, "")]
            if not cells:
                continue
            texts = [str(c.value).strip() for c in cells]
            bold = all(bool(c.font and c.font.b) for c in cells)
            size = max((c.font.sz for c in cells if c.font and c.font.sz), default=11.0)
            text = " | ".join(texts) if len(texts) > 1 else texts[0]
            page.lines.append(
                Line(
                    text=text,
                    top=y,
                    x0=float(cells[0].column),
                    size=float(size),
                    bold=bold,
                    checkboxes=text.count("☐") + text.count("□"),
                )
            )
            y += 12
        _mark_choice_rows(page.lines)
        if page.lines:
            pages.append(page)
    return Document(pages=pages or [Page(number=1)], source_kind="xlsx")


def _mark_choice_rows(lines: list[Line]) -> None:
    """Sheet cells cannot hold the box glyphs a PDF has, so the option rows of a choice list arrive as plain text.
    Rows under a 'prompt:' row become ☐ options when there are at least two of them and each one finishes the
    prompt's sentence ('zaświadczenia o:' -> 'okresie posiadania ...'): one cell, lower-case start, short, not a
    heading. A row with a fill ('inne ……') closes the list, as it does on paper."""
    for i, prompt in enumerate(lines):
        if not prompt.text.rstrip(" *").endswith(":"):
            continue
        opts: list[Line] = []
        for ln in lines[i + 1 :]:
            t = ln.text.strip()
            if ln.is_heading or not t[:1].islower() or ENUM_RE.match(t) or "|" in t or len(t) > 120 or t.endswith(":"):
                break
            opts.append(ln)
            if FILL_RE.search(t):
                break
        if len(opts) >= 2 and not FILL_RE.search(opts[0].text):
            for ln in opts:
                ln.text = "☐ " + ln.text
                ln.checkboxes += 1


# ---------------------------------------------------------------- ODS
def parse_ods(data: bytes) -> Document:
    """Parse content.xml directly (stdlib); odfpy stays available but the XML is simple enough."""
    NS = {
        "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
        "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    }
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ET.fromstring(z.read("content.xml"))
    pages = []
    for n, tbl in enumerate(root.iter(f"{{{NS['table']}}}table"), start=1):
        page = Page(number=n)
        y = 0.0
        for row in tbl.iter(f"{{{NS['table']}}}table-row"):
            texts = []
            for cell in row:
                if not cell.tag.endswith("table-cell"):
                    continue
                t = " ".join("".join(p.itertext()).strip() for p in cell.iter(f"{{{NS['text']}}}p")).strip()
                if t:
                    texts.append(t)
            if texts:
                text = " | ".join(texts)
                page.lines.append(Line(text=text, top=y, checkboxes=text.count("☐") + text.count("□")))
                y += 12
        if page.lines:
            pages.append(page)
    return Document(pages=pages or [Page(number=1)], source_kind="ods")


# ---------------------------------------------------------------- DOC (binary) via Tika
def parse_doc_via_tika(data: bytes, tika_url: str, timeout: float = 60.0) -> Document:
    import httpx

    r = httpx.put(
        f"{tika_url.rstrip('/')}/tika",
        content=data,
        headers={"Accept": "text/plain", "Content-Type": "application/msword"},
        timeout=timeout,
    )
    r.raise_for_status()
    page = Page(number=1)
    y = 0.0
    for raw in r.text.splitlines():
        t = re.sub(r"\s+", " ", raw).strip()
        if t:
            page.lines.append(Line(text=t, top=y, checkboxes=t.count("☐") + t.count("□")))
            y += 12
    return Document(pages=[page], source_kind="doc")


# ---------------------------------------------------------------- DOC (binary) without Tika: crude text salvage
def parse_doc_crude(data: bytes) -> Document:
    """Last resort for Word 97-2003 files when no converter is available: pull UTF-16LE and cp1250 text runs
    out of the OLE container. Loses layout, keeps most labels. Marked in the Document as ``source_kind='doc-crude'``."""
    texts: list[str] = []
    # UTF-16LE pairs: Latin-1 (high byte 0x00) and Latin Extended-A incl. Polish ąćęłńóśźż (high byte 0x01)
    for m in re.finditer(rb"(?:[\x20-\x7e\x80-\xff]\x00|[\x00-\xff]\x01){6,}", data):
        try:
            t = m.group(0).decode("utf-16-le", errors="ignore")
        except UnicodeDecodeError:
            continue
        t = "".join(ch for ch in t if ch.isprintable() or ch in "\r\n\t")
        if sum(ch.isalpha() for ch in t) >= 4:
            texts.append(t)
    if not texts:
        for m in re.finditer(rb"[\x20-\x7e\xa0-\xff]{8,}", data):
            t = m.group(0).decode("cp1250", errors="ignore")
            if sum(ch.isalpha() for ch in t) >= 6:
                texts.append(t)
    page = Page(number=1)
    y = 0.0
    for raw in "\n".join(texts).replace("\r", "\n").split("\n"):
        t = re.sub(r"\s+", " ", raw).strip()
        if len(t) >= 3:
            page.lines.append(Line(text=t, top=y, checkboxes=t.count("☐") + t.count("□")))
            y += 12
    return Document(pages=[page], source_kind="doc-crude")
