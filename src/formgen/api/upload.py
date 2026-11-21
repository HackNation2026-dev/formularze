"""Upload validation in fail-fast order (SPEC.md section D)."""

from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import UploadFile

from formgen.api.errors import ApiError
from formgen.api.settings import Settings
from formgen.ingest.detect import KIND_BY_EXT, kind_for


@dataclass(frozen=True)
class ValidUpload:
    filename: str
    ext: str
    kind: str
    detected: str
    score: float
    data: bytes


def validate_filename(name: str, s: Settings) -> str:
    raw = name or ""
    if not raw.strip():
        raise ApiError(400, "MISSING_FILE", "no file name")
    # check the name as sent (before any path stripping) so '/' and '\\' are rejected, not silently cut
    bad = sorted({c for c in raw if c in s.forbidden_filename_chars})
    if bad:
        raise ApiError(400, "INVALID_FILENAME", "file name contains forbidden characters", {"chars": bad})
    base = os.path.basename(raw)
    if len(base) > s.max_filename_length:
        raise ApiError(
            400, "INVALID_FILENAME", f"file name longer than {s.max_filename_length} characters", {"length": len(base)}
        )
    ext = base.rsplit(".", 1)[-1].lower() if "." in base else ""
    if ext not in s.allowed_ext_set or ext not in KIND_BY_EXT:
        raise ApiError(
            415, "UNSUPPORTED_MEDIA_TYPE", f"extension '.{ext}' not supported", {"allowed": sorted(s.allowed_ext_set)}
        )
    return ext


async def read_limited(file: UploadFile, limit: int) -> bytes:
    """Read the stream in chunks; stop as soon as the limit is crossed (R-07, R-08: memory only)."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ApiError(413, "FILE_TOO_LARGE", f"file exceeds {limit // (1024 * 1024)} MB", {"limit_bytes": limit})
        chunks.append(chunk)
    if total == 0:
        raise ApiError(400, "MISSING_FILE", "uploaded file is empty")
    return b"".join(chunks)


async def validate_upload(file: UploadFile | None, s: Settings, content_length: int | None = None) -> ValidUpload:
    if file is None:
        raise ApiError(400, "MISSING_FILE", "multipart field 'file' is required")
    if content_length is not None and content_length > s.max_upload_bytes + 4096:
        raise ApiError(
            413, "FILE_TOO_LARGE", f"request exceeds {s.max_upload_size_mb} MB", {"limit_bytes": s.max_upload_bytes}
        )
    ext = validate_filename(file.filename or "", s)
    data = await read_limited(file, s.max_upload_bytes)
    try:
        kind, detected, score = kind_for(ext, data)
    except ValueError as exc:
        raise ApiError(415, "MIME_MISMATCH", str(exc), {"extension": ext}) from exc
    return ValidUpload(os.path.basename(file.filename or ""), ext, kind, detected, score, data)
