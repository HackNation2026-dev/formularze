"""FastAPI application. Contract: docs/SPEC.md section B."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from formgen import __version__, pipeline
from formgen.api.errors import ApiError
from formgen.api.security import require_auth
from formgen.api.settings import Settings, get_settings
from formgen.api.upload import validate_upload
from formgen.schema import FormDefinition, Severity, check_rules, check_sample_values

log = logging.getLogger("formgen")


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or get_settings()
    app = FastAPI(
        title=s.app_name,
        version=__version__,
        description="Upload a paper-form file, receive a Generator Formularzy FormDefinition JSON.",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    if settings is not None:
        app.dependency_overrides[get_settings] = lambda: settings

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.get("/health", tags=["ops"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    @app.get("/ready", tags=["ops"])
    async def ready(st: Settings = Depends(get_settings)) -> dict[str, Any]:
        return {"status": "ok", "llm": st.llm_base_url, "ocr": st.ocr_backend}

    @app.get("/api/v1/formats", tags=["forms"])
    async def formats(st: Settings = Depends(get_settings)) -> dict[str, Any]:
        return {"extensions": sorted(st.allowed_ext_set), "max_upload_size_mb": st.max_upload_size_mb}

    @app.post("/api/v1/forms/analyze", tags=["forms"], response_model=None)
    async def analyze(
        request: Request,
        file: UploadFile | None = File(default=None),
        st: Settings = Depends(get_settings),
        _auth: dict | None = Depends(require_auth),
    ) -> JSONResponse:
        cl = request.headers.get("content-length")
        up = await validate_upload(file, st, int(cl) if cl and cl.isdigit() else None)
        # R-08: nothing persisted; any scratch files live in a per-request temp dir
        with tempfile.TemporaryDirectory(prefix="formgen-") as _tmp:
            try:
                result = pipeline.run(up.data, up.kind, up.filename, st)
            except TimeoutError as exc:
                raise ApiError(504, "PROCESSING_TIMEOUT", str(exc)) from exc
            except ConnectionError as exc:
                raise ApiError(503, "MODEL_UNAVAILABLE", str(exc)) from exc
        if not result.ok:
            errors = [str(v) for v in result.violations if v.severity == Severity.ERROR]
            log.error("pipeline produced invalid form for %s: %s", up.filename, errors)
            raise ApiError(500, "INVALID_OUTPUT", "generated form failed technical rules", {"errors": errors})
        return JSONResponse(
            content=result.form.to_json_dict(),
            headers={
                "X-Processing-Time-Ms": str(result.elapsed_ms),
                "X-Detected-Type": f"{up.detected};score={up.score:.3f}",
                "X-Warnings": str(sum(v.severity == Severity.WARNING for v in result.violations)),
                "X-Extractor": str(result.trace.get("extractor", "")),
            },
        )

    @app.post("/api/v1/forms/validate", tags=["forms"])
    async def validate(body: dict[str, Any], _auth: dict | None = Depends(require_auth)) -> dict[str, Any]:
        sample_values = body.pop("sample_values", None) or {}
        if not isinstance(sample_values, dict):
            raise ApiError(422, "INVALID_SAMPLE_VALUES", "sample_values must be an object techName -> value")
        try:
            form = FormDefinition.from_json_dict(body)
        except Exception as exc:  # pydantic ValidationError
            raise ApiError(422, "INVALID_FORM_DEFINITION", str(exc)[:2000]) from exc
        v = check_rules(form)
        sample_errors, sample_unknown = check_sample_values(form, sample_values)
        return {
            "valid": not any(x.severity == Severity.ERROR for x in v),
            "errors": [x.__dict__ for x in v if x.severity == Severity.ERROR],
            "warnings": [x.__dict__ for x in v if x.severity == Severity.WARNING],
            "sample_errors": sample_errors,
            "sample_unknown": sample_unknown,
        }

    app.mount(
        "/review",
        StaticFiles(directory=Path(__file__).resolve().parents[1] / "static" / "review", html=True),
        name="review",
    )
    return app


app = create_app()
