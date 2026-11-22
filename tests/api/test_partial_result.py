"""X-Partial-Result: the official must never mistake a form with a dropped source fragment for a complete one.

Only the model server is substituted (an ``httpx.MockTransport`` behind the real ``LlmClient``); ingestion,
extraction, composition and the HTTP layer run unchanged.
"""

import json

import httpx
from fastapi.testclient import TestClient

from formgen.api.app import create_app
from formgen.config import Settings
from tests.api.test_analyze import SAMPLE_FILES

PDF = next(p for p in SAMPLE_FILES if "nadp" in p.name and p.suffix.lower() == ".pdf")
COMPLETE = {"LlmGlobal": {"title": "Wniosek testowy"}, "LlmChunk": {"sections": []}}
CUT_OFF = '{"sections": [{"page_title": "Sprawa", "title": "Rach'
REAL_CLIENT = httpx.Client


def model_server(answer, calls: dict[str, int]) -> httpx.MockTransport:
    """Serve ``answer(schema, call_number) -> (content, finish_reason)`` as llama.cpp's chat completions."""

    def handle(request: httpx.Request) -> httpx.Response:
        schema = json.loads(request.content)["response_format"]["json_schema"]["name"]
        calls[schema] = calls.get(schema, 0) + 1
        content, finish = answer(schema, calls[schema])
        body = {"choices": [{"message": {"content": content}, "finish_reason": finish}], "usage": {}}
        return httpx.Response(200, json=body)

    return httpx.MockTransport(handle)


def fake_model(monkeypatch, answer) -> dict[str, int]:
    calls: dict[str, int] = {}
    server = model_server(answer, calls)

    def client(*args, transport=None, **kwargs):
        return REAL_CLIENT(*args, transport=server, **kwargs)

    monkeypatch.setattr("formgen.extract.llm_client.httpx.Client", client)
    return calls


def complete(schema, _n):
    return json.dumps(COMPLETE[schema]), "stop"


def _settings() -> Settings:
    return Settings(auth_enabled=False, extractor="llm", llm_base_url="http://llm.test", _env_file=None)


def _analyze():
    client = TestClient(create_app(_settings()))
    return client.post("/api/v1/forms/analyze", files={"file": (PDF.name, PDF.read_bytes())})


def test_complete_model_answer_is_not_marked_partial(monkeypatch):
    fake_model(monkeypatch, complete)
    r = _analyze()
    assert r.status_code == 200, r.text
    assert r.headers["X-Extractor"] == "LlmExtractor"
    assert r.headers["X-Partial-Result"] == "false"
    assert "X-Partial-Reasons" not in r.headers


def test_skipped_chunk_marks_result_partial_and_counts_as_warning(monkeypatch):
    fake_model(monkeypatch, complete)
    baseline = int(_analyze().headers["X-Warnings"])
    fake_model(monkeypatch, lambda s, n: (CUT_OFF, "length") if s == "LlmChunk" else complete(s, n))
    r = _analyze()
    assert r.status_code == 200, r.text
    assert r.headers["X-Extractor"] == "LlmExtractor"
    assert r.headers["X-Partial-Result"] == "true"
    reasons = r.headers["X-Partial-Reasons"].split("; ")
    assert reasons and all(x.startswith("chunk-skipped:") for x in reasons)
    assert int(r.headers["X-Warnings"]) == baseline + len(reasons)


def test_truncated_answer_that_was_used_marks_result_partial(monkeypatch):
    fake_model(monkeypatch, lambda s, n: (json.dumps(COMPLETE[s]), "length" if s == "LlmChunk" else "stop"))
    r = _analyze()
    assert r.status_code == 200, r.text
    assert r.headers["X-Partial-Result"] == "true"
    assert "llm-truncated:LlmChunk" in r.headers["X-Partial-Reasons"]


def test_heuristic_fallback_marks_result_partial(monkeypatch):
    fake_model(monkeypatch, lambda s, n: ("not json", "stop") if s == "LlmGlobal" else complete(s, n))
    r = _analyze()
    assert r.status_code == 200, r.text
    assert r.headers["X-Extractor"] == "HeuristicExtractor"
    assert r.headers["X-Partial-Result"] == "true"
    assert r.headers["X-Partial-Reasons"] == "extractor-fallback:ValueError"


def test_batch_reports_partial_result_per_file(monkeypatch):
    fake_model(monkeypatch, lambda s, n: (CUT_OFF, "length") if s == "LlmChunk" else complete(s, n))
    client = TestClient(create_app(_settings()))
    r = client.post("/api/v1/forms/analyze-batch", files=[("files", (PDF.name, PDF.read_bytes()))])
    assert r.status_code == 200, r.text
    [entry] = r.json()["results"]
    assert entry["partial"] is True
    assert entry["partial_reasons"] and entry["partial_reasons"][0].startswith("chunk-skipped:")


def test_truncation_recovered_by_split_retry_is_not_partial():
    from formgen.extract.extractor import LlmExtractor
    from formgen.extract.llm_client import LlmClient
    from formgen.ingest.model import Document, Line, Page

    calls: dict[str, int] = {}
    cut_once = model_server(lambda s, n: (CUT_OFF, "length") if (s, n) == ("LlmChunk", 1) else complete(s, n), calls)
    extractor = LlmExtractor(LlmClient("http://llm.test", transport=cut_once))
    doc = Document(pages=[Page(number=1, lines=[Line(f"Pole {i} ________", top=i) for i in range(120)])])
    extractor.extract_document(doc, "x.pdf", _settings())
    assert calls["LlmChunk"] == 3, "the cut chunk must have been retried as two halves"
    assert extractor.partial_reasons == []
