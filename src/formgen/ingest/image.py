"""JPG/PNG -> Document. Splits stacked A4 renders into pages, OCR with Tesseract (Apache-2.0) `pol`."""

from __future__ import annotations

import io

import pytesseract
from PIL import Image

from formgen.ingest.model import Document, Line, Page

A4_RATIO = 1.4142
MAX_PIXELS = 200_000_000


def split_pages(im: Image.Image) -> list[Image.Image]:
    w, h = im.size
    n = max(1, round(h / (w * A4_RATIO)))
    if n == 1:
        return [im]
    step = h / n
    return [im.crop((0, int(i * step), w, int((i + 1) * step))) for i in range(n)]


def parse_image(data: bytes, lang: str = "pol") -> Document:
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    pages: list[Page] = []
    for n, pim in enumerate(split_pages(im), start=1):
        if pim.width < 1400:  # upscale low-dpi scans; OCR likes >= 200 dpi
            scale = 1654 / pim.width
            pim = pim.resize((int(pim.width * scale), int(pim.height * scale)), Image.LANCZOS)
        tsv = pytesseract.image_to_data(pim, lang=lang, config="--psm 4", output_type=pytesseract.Output.DICT)
        page = Page(number=n, width=pim.width, height=pim.height)
        groups: dict[tuple[int, int, int], list[int]] = {}
        for i, txt in enumerate(tsv["text"]):
            if not txt.strip() or int(tsv["conf"][i]) < 0:
                continue
            key = (tsv["block_num"][i], tsv["par_num"][i], tsv["line_num"][i])
            groups.setdefault(key, []).append(i)
        for idx in groups.values():
            idx.sort(key=lambda i: tsv["left"][i])
            text = " ".join(tsv["text"][i] for i in idx)
            top = min(tsv["top"][i] for i in idx)
            h = max(tsv["height"][i] for i in idx)
            page.lines.append(
                Line(
                    text=text,
                    top=float(top),
                    x0=float(tsv["left"][idx[0]]),
                    size=float(h),
                    bold=False,
                    checkboxes=text.count("☐") + text.count("□"),
                )
            )
        page.lines.sort(key=lambda ln: (ln.top, ln.x0))
        pages.append(page)
    return Document(pages=pages, source_kind="image", ocr=True)
