"""Ingest: bytes + kind -> Document."""

from __future__ import annotations

from formgen.ingest.model import Document, Line, Page, Table


def load(data: bytes, kind: str, *, tika_url: str | None = None, ocr_lang: str = "pol") -> Document:
    if kind == "pdf":
        from formgen.ingest.pdf import parse_pdf

        doc = parse_pdf(data)
        if sum(len(p.lines) for p in doc.pages) < 3:  # scanned PDF without text layer -> rasterise + OCR
            from formgen.ingest.pdf_raster import parse_scanned_pdf

            return parse_scanned_pdf(data, ocr_lang)
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
