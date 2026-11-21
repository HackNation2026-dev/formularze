"""Scanned PDF (no text layer): render pages with pypdfium2 (Apache/BSD) and OCR them."""

from __future__ import annotations

import io

import pypdfium2 as pdfium

from formgen.ingest.image import parse_image
from formgen.ingest.model import Document, Page


def parse_scanned_pdf(data: bytes, lang: str = "pol", scale: float = 200 / 72) -> Document:
    pdf = pdfium.PdfDocument(io.BytesIO(data))
    pages: list[Page] = []
    for i in range(len(pdf)):
        bitmap = pdf[i].render(scale=scale)
        buf = io.BytesIO()
        bitmap.to_pil().save(buf, format="PNG")
        doc = parse_image(buf.getvalue(), lang)
        for p in doc.pages:
            p.number = i + 1
            pages.append(p)
    return Document(pages=pages, source_kind="pdf", ocr=True)
