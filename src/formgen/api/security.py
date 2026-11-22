"""Bearer JWT verification (R-16). Disabled when AUTH_ENABLED=false (demo mode)."""

from __future__ import annotations

import datetime as dt
from typing import Any

import jwt
from fastapi import Depends, Request

from formgen.api.errors import ApiError
from formgen.config import Settings, get_settings


def issue_token(s: Settings, subject: str = "demo", hours: int = 24, **claims: Any) -> str:
    now = dt.datetime.now(dt.UTC)
    payload: dict[str, Any] = {"sub": subject, "iat": now, "exp": now + dt.timedelta(hours=hours), **claims}
    if s.jwt_issuer:
        payload["iss"] = s.jwt_issuer
    if s.jwt_audience:
        payload["aud"] = s.jwt_audience
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def verify_token(token: str, s: Settings) -> dict[str, Any]:
    if not s.jwt_secret:
        raise ApiError(500, "AUTH_MISCONFIGURED", "JWT_SECRET is not set")
    try:
        return jwt.decode(
            token,
            s.jwt_secret,
            algorithms=[s.jwt_algorithm],
            issuer=s.jwt_issuer,
            audience=s.jwt_audience,
            leeway=s.jwt_leeway_seconds,
            options={"require": ["exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "UNAUTHORIZED", "token expired") from exc
    except jwt.PyJWTError as exc:
        raise ApiError(401, "UNAUTHORIZED", f"invalid token: {exc}") from exc


async def require_auth(request: Request, s: Settings = Depends(get_settings)) -> dict[str, Any] | None:
    if not s.auth_enabled:
        return None
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise ApiError(401, "UNAUTHORIZED", "missing bearer token")
    return verify_token(header[7:].strip(), s)
