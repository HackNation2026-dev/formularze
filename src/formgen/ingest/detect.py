"""Content-type detection (R-04): the file's bytes must agree with its extension.

Primary detector: Google ``magika`` (Apache-2.0, ONNX, no system libmagic).
Returns the canonical kind we route on: pdf | doc | docx | ods | xlsx | jpeg | png.
"""

from __future__ import annotations

from functools import lru_cache

from magika import Magika

KIND_BY_EXT = {
    "pdf": "pdf",
    "doc": "doc",
    "docx": "docx",
    "ods": "ods",
    "xlsx": "xlsx",
    "jpg": "jpeg",
    "jpeg": "jpeg",
    "jpe": "jpeg",
    "png": "png",
}
MIME_BY_KIND = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ods": "application/vnd.oasis.opendocument.spreadsheet",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "jpeg": "image/jpeg",
    "png": "image/png",
}
# A ``.doc`` named file is accepted when it is really DOCX (seen in the organiser's own samples).
COMPATIBLE = {"doc": {"doc", "docx"}}


@lru_cache
def _magika() -> Magika:
    return Magika()


def detect_kind(data: bytes) -> tuple[str, float]:
    """Return (magika label, score)."""
    r = _magika().identify_bytes(data)
    return r.output.label, float(r.score)


def kind_for(ext: str, data: bytes) -> tuple[str, str, float]:
    """Resolve the processing kind. Raises ValueError on mismatch.

    Returns (kind_to_process, detected_label, score).
    """
    expected = KIND_BY_EXT[ext.lower()]
    label, score = detect_kind(data)
    allowed = COMPATIBLE.get(expected, {expected})
    if label not in allowed:
        raise ValueError(f"content is '{label}', extension says '{expected}'")
    return label, label, score
