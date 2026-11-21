"""Uniform error envelope: ``{"error": {"code", "message", "details"}}``."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(status_code=status, detail={"code": code, "message": message, "details": details or {}})
        self.code = code
