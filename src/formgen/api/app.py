"""FastAPI application. Contract: docs/SPEC.md section B."""

from __future__ import annotations

import logging
import re
import threading
import time
from pathlib import Path
from typing import Any

import anyio
from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from formgen import __version__, pipeline
from formgen.api.errors import ApiError
from formgen.api.security import require_auth
from formgen.api.upload import ValidUpload, validate_upload
from formgen.config import Settings, get_settings
from formgen.extract.extractor import warm_up
from formgen.extract.llm_client import make_client
from formgen.schema import FormDefinition, Severity, check_rules, check_sample_values

log = logging.getLogger("formgen")


async def _process(up: ValidUpload, st: Settings) -> tuple[dict[str, Any], dict[str, Any]]:
    """Run the pipeline on one validated upload; returns (FormDefinition JSON, metadata) or raises ApiError."""
    try:
        # pipeline.run is blocking (OCR, LLM over HTTP); keep the event loop free for other requests.
        # On timeout the worker thread is abandoned and finishes in the background.
        with anyio.fail_after(st.request_timeout_seconds):
            result = await anyio.to_thread.run_sync(
                pipeline.run, up.data, up.kind, up.filename, st, abandon_on_cancel=True
            )
    except TimeoutError as exc:
        raise ApiError(
            504, "PROCESSING_TIMEOUT", str(exc) or f"processing exceeded {st.request_timeout_seconds} s"
        ) from exc
    except ConnectionError as exc:
        raise ApiError(503, "MODEL_UNAVAILABLE", str(exc)) from exc
    if not result.ok:
        errors = [str(v) for v in result.violations if v.severity == Severity.ERROR]
        log.error("pipeline produced invalid form for %s: %s", up.filename, errors)
        raise ApiError(500, "INVALID_OUTPUT", "generated form failed technical rules", {"errors": errors})
    return result.form.to_json_dict(), {
        "processing_time_ms": result.elapsed_ms,
        "detected_type": up.detected,
        "detected_score": round(up.score, 3),
        "warnings": sum(v.severity == Severity.WARNING for v in result.violations) + len(result.partial_reasons),
        "extractor": str(result.trace.get("extractor", "")),
        "partial": bool(result.partial_reasons),
        "partial_reasons": list(result.partial_reasons),
    }


def _header_value(text: str, limit: int = 1000) -> str:
    """HTTP header values are ASCII; anything else becomes ``?``."""
    return re.sub(r"[^\x20-\x7e]", "?", text)[:limit]


def _warm_up_llm(st: Settings, wait_seconds: float = 600.0) -> None:
    """Wait for the LLM server, then prefill the prompts' shared instruction prefix into its prompt cache."""
    client = make_client(st)
    deadline = time.monotonic() + wait_seconds
    while not client.alive():
        if time.monotonic() > deadline:
            log.warning("LLM warm-up skipped: server not up after %.0f s", wait_seconds)
            return
        time.sleep(5)
    t0 = time.monotonic()
    try:
        warm_up(client)
    except (ConnectionError, TimeoutError) as exc:
        log.warning("LLM warm-up failed: %s", exc)
        return
    log.info("LLM warm-up done in %.1f s", time.monotonic() - t0)


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
    if s.extractor == "llm" and s.llm_warm_up:
        threading.Thread(target=_warm_up_llm, args=(s,), name="llm-warm-up", daemon=True).start()

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.get("/health", tags=["ops"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    @app.get("/ready", tags=["ops"])
    async def ready(st: Settings = Depends(get_settings)) -> JSONResponse:
        body: dict[str, Any] = {
            "status": "ok",
            "extractor": st.extractor,
            "llm": st.llm_base_url,
            "ocr": st.ocr_backend,
        }
        if st.extractor == "llm":
            body["llm_alive"] = await anyio.to_thread.run_sync(make_client(st).alive)
            if not body["llm_alive"]:
                # with the heuristic fallback the service still answers, only with lower quality
                body["status"] = "degraded" if st.llm_fallback_heuristic else "unavailable"
        return JSONResponse(body, status_code=503 if body["status"] == "unavailable" else 200)

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
        form, meta = await _process(up, st)
        headers = {
            "X-Processing-Time-Ms": str(meta["processing_time_ms"]),
            "X-Detected-Type": f"{meta['detected_type']};score={meta['detected_score']:.3f}",
            "X-Warnings": str(meta["warnings"]),
            "X-Extractor": meta["extractor"],
            # the body stays a clean FormDefinition; content the extractor may have missed is announced here
            "X-Partial-Result": "true" if meta["partial"] else "false",
        }
        if meta["partial"]:
            headers["X-Partial-Reasons"] = _header_value("; ".join(meta["partial_reasons"]))
        return JSONResponse(content=form, headers=headers)

    @app.post("/api/v1/forms/analyze-batch", tags=["forms"])
    async def analyze_batch(
        files: list[UploadFile] | None = File(default=None),
        st: Settings = Depends(get_settings),
        _auth: dict | None = Depends(require_auth),
    ) -> dict[str, Any]:
        """Several files in one request, processed one after another (each with its own timeout).
        A failing file does not fail the batch: its entry carries the same error envelope as /analyze."""
        if not files:
            raise ApiError(400, "MISSING_FILE", "multipart field 'files' is required")
        if len(files) > st.max_batch_files:
            raise ApiError(413, "TOO_MANY_FILES", f"at most {st.max_batch_files} files per batch")
        results: list[dict[str, Any]] = []
        for f in files:
            try:
                form, meta = await _process(await validate_upload(f, st), st)
                results.append({"filename": f.filename, "status": 200, "form": form, **meta})
            except ApiError as exc:
                results.append({"filename": f.filename, "status": exc.status_code, "error": exc.detail})
        ok = sum(r["status"] == 200 for r in results)
        return {"results": results, "ok": ok, "failed": len(results) - ok}

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
