"""PDF pages without a text layer: render them with pypdfium2 (Apache/BSD) and OCR them."""

from __future__ import annotations

import io

import pypdfium2 as pdfium

from formgen.ingest.image import parse_image
from formgen.ingest.model import Page


def ocr_pdf_pages(data: bytes, numbers: list[int], lang: str = "pol", scale: float = 200 / 72) -> list[Page]:
    """OCR the given 1-based page numbers; returns one Page per number, in order."""
    pdf = pdfium.PdfDocument(io.BytesIO(data))
    pages: list[Page] = []
    for n in numbers:
        buf = io.BytesIO()
        pdf[n - 1].render(scale=scale).to_pil().save(buf, format="PNG")
        ocr = parse_image(buf.getvalue(), lang).pages
        page = ocr[0]
        page.number = n
        for extra in ocr[1:]:  # an unusually tall page split in two: keep it as one page
            page.lines.extend(extra.lines)
        pages.append(page)
    return pages
