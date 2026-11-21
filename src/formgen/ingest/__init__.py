"""Ingest: bytes + kind -> Document."""

from __future__ import annotations

from formgen.ingest.model import Document, Line, Page, Table

MIN_PAGE_CHARS = 50


def _text_chars(page: Page) -> int:
    texts = [ln.text for ln in page.lines] + [c for t in page.tables for r in t.rows for c in r]
    return sum(len(t.replace(" ", "")) for t in texts)


def load(data: bytes, kind: str, *, tika_url: str | None = None, ocr_lang: str = "pol") -> Document:
    if kind == "pdf":
        from formgen.ingest.pdf import parse_pdf

        doc = parse_pdf(data)
        # pages without a usable text layer (scans, also inside an otherwise digital PDF) -> rasterise + OCR
        scanned = [i for i, p in enumerate(doc.pages) if _text_chars(p) < MIN_PAGE_CHARS]
        if scanned:
            from formgen.ingest.pdf_raster import ocr_pdf_pages

            for i, page in zip(
                scanned, ocr_pdf_pages(data, [doc.pages[i].number for i in scanned], ocr_lang), strict=True
            ):
                doc.pages[i] = page
            doc.ocr = True
        return doc
    if kind == "docx":
        from formgen.ingest.office import parse_docx

        return parse_docx(data)
    if kind == "xlsx":
        from formgen.ingest.office import parse_xlsx

        return parse_xlsx(data)
    if kind == "ods":
        from formgen.ingest.office import parse_ods

        return parse_ods(data)
    if kind == "doc":
        from formgen.ingest.office import parse_doc_crude, parse_doc_via_tika

        if tika_url:
            try:
                return parse_doc_via_tika(data, tika_url)
            except Exception as exc:
                import logging

                logging.getLogger("formgen.ingest").warning("Tika failed (%s); using crude .doc salvage", exc)
        return parse_doc_crude(data)
    if kind in ("jpeg", "png"):
        from formgen.ingest.image import parse_image

        return parse_image(data, ocr_lang)
    raise ValueError(f"unsupported kind {kind}")


__all__ = ["Document", "Line", "Page", "Table", "load"]
