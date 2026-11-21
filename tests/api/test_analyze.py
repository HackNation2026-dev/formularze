import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from formgen.api.app import create_app
from formgen.api.security import issue_token
from formgen.api.settings import Settings
from formgen.schema import FormDefinition, Severity, check_rules
from tests.conftest import ROOT

SAMPLES = ROOT / "data" / "input" / "01_przyklady_formularze"
SAMPLE_FILES = sorted(
    p
    for p in SAMPLES.glob("*/*")
    if p.suffix.lower().lstrip(".") in {"pdf", "doc", "docx", "ods", "xlsx", "jpg", "jpeg", "png"}
)


@pytest.fixture
def settings() -> Settings:
    return Settings(
        auth_enabled=True,
        jwt_secret="test-secret-with-at-least-32-bytes-ok",
        max_upload_size_mb=10,
        extractor="stub",
        _env_file=None,
    )


@pytest.fixture
def client(settings) -> TestClient:
    return TestClient(create_app(settings))


@pytest.fixture
def auth(settings) -> dict[str, str]:
    return {"Authorization": f"Bearer {issue_token(settings)}"}


def _upload(client, auth, name: str, data: bytes, ctype: str = "application/octet-stream"):
    return client.post("/api/v1/forms/analyze", files={"file": (name, io.BytesIO(data), ctype)}, headers=auth)


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_review_ui_is_served_without_token(client):
    r = client.get("/review/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


def test_requires_token(client):
    r = client.post("/api/v1/forms/analyze", files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 401 and r.json()["error"]["code"] == "UNAUTHORIZED"


def test_bad_token(client):
    r = client.post(
        "/api/v1/forms/analyze",
        files={"file": ("a.pdf", b"%PDF-1.4", "application/pdf")},
        headers={"Authorization": "Bearer nope"},
    )
    assert r.status_code == 401


def test_missing_file(client, auth):
    r = client.post("/api/v1/forms/analyze", headers=auth)
    assert r.status_code == 400 and r.json()["error"]["code"] == "MISSING_FILE"


@pytest.mark.parametrize("ch", list(";:<>/\\|'*%$"))
def test_forbidden_filename_chars(client, auth, ch):
    r = _upload(client, auth, f"wniosek{ch}1.pdf", b"%PDF-1.4")
    assert r.status_code == 400, ch
    assert r.json()["error"]["code"] == "INVALID_FILENAME"


def test_filename_too_long(client, auth):
    r = _upload(client, auth, "a" * 247 + ".pdf", b"%PDF-1.4")
    assert r.status_code == 400 and r.json()["error"]["details"]["length"] == 251


def test_filename_250_ok_but_content_checked(client, auth):
    r = _upload(client, auth, "a" * 246 + ".pdf", b"not a pdf at all")
    assert r.status_code == 415 and r.json()["error"]["code"] == "MIME_MISMATCH"


def test_unsupported_extension(client, auth):
    r = _upload(client, auth, "wniosek.txt", b"hello")
    assert r.status_code == 415 and r.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_too_large(client, auth):
    r = _upload(client, auth, "big.pdf", b"%PDF-1.4" + b"0" * (11 * 1024 * 1024))
    assert r.status_code == 413 and r.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_mime_mismatch_png_as_pdf(client, auth):
    png = next(p for p in SAMPLE_FILES if p.suffix.lower() == ".png").read_bytes()
    r = _upload(client, auth, "wniosek.pdf", png)
    assert r.status_code == 415 and r.json()["error"]["code"] == "MIME_MISMATCH"


@pytest.mark.parametrize("path", SAMPLE_FILES, ids=[p.name for p in SAMPLE_FILES])
def test_all_sample_files_accepted(client, auth, path: Path):
    r = _upload(client, auth, path.name, path.read_bytes())
    assert r.status_code == 200, r.text
    form = FormDefinition.from_json_dict(r.json())
    assert not [v for v in check_rules(form) if v.severity == Severity.ERROR]
    assert r.headers["X-Processing-Time-Ms"].isdigit()


def test_validate_endpoint_golden(client, auth, golden_dict):
    r = client.post("/api/v1/forms/validate", json=golden_dict, headers=auth)
    assert r.status_code == 200 and r.json()["valid"] is True


def test_validate_endpoint_without_sample_values_has_empty_sample_lists(client, auth, golden_dict):
    body = client.post("/api/v1/forms/validate", json=golden_dict, headers=auth).json()
    assert body["sample_errors"] == [] and body["sample_unknown"] == []


def _fields(node):
    for q in node.get("questions", []) + node.get("repeatingSectionGrid", []):
        yield q["field"]
        yield from _fields(q["field"])


def test_validate_endpoint_sample_values(client, auth, golden_dict):
    field = next(f for tab in golden_dict["tabs"] for f in _fields(tab) if f["type"] == "TEXT_FIELD")
    field["validation"] = ["PESEL"]
    body = {**golden_dict, "sample_values": {field["techName"]: "55030101194", "nie_ma_takiego_pola": "x"}}
    r = client.post("/api/v1/forms/validate", json=body, headers=auth).json()
    assert r["valid"] is True
    assert r["sample_errors"] == [{"techName": field["techName"], "value": "55030101194", "failed": ["PESEL"]}]
    assert r["sample_unknown"] == ["nie_ma_takiego_pola"]

    body["sample_values"] = {field["techName"]: "55030101193"}
    r = client.post("/api/v1/forms/validate", json=body, headers=auth).json()
    assert r["sample_errors"] == [] and r["sample_unknown"] == []


def test_validate_endpoint_broken(client, auth):
    r = client.post("/api/v1/forms/validate", json={"title": "x", "tabs": [], "flow": {"links": []}}, headers=auth)
    assert r.json()["valid"] is False
    assert any(e["code"] == "TABS_MIN_TWO" for e in r.json()["errors"])


def test_auth_disabled_mode():
    s = Settings(auth_enabled=False, extractor="stub", _env_file=None)
    c = TestClient(create_app(s))
    assert c.get("/api/v1/formats").status_code == 200
    pdf = next(p for p in SAMPLE_FILES if p.suffix.lower() == ".pdf")
    assert c.post("/api/v1/forms/analyze", files={"file": (pdf.name, pdf.read_bytes())}).status_code == 200


def test_llm_down_falls_back_to_heuristic():
    s = Settings(
        auth_enabled=False, extractor="llm", llm_base_url="http://127.0.0.1:9", llm_timeout_seconds=2, _env_file=None
    )
    c = TestClient(create_app(s))
    pdf = next(p for p in SAMPLE_FILES if p.suffix.lower() == ".pdf")
    r = c.post("/api/v1/forms/analyze", files={"file": (pdf.name, pdf.read_bytes())})
    assert r.status_code == 200, r.text
    assert r.headers["X-Extractor"] == "HeuristicExtractor"
    assert len(r.json()["tabs"]) >= 3
