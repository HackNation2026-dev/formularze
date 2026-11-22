"""LLM client against fake endpoints: auth header, portable retry for cloud providers, endpoint chain."""

import json

import httpx
import pytest

from formgen.extract.llm_client import ChainedClient, LlmClient, LlmUnavailable
from formgen.extract.schema import LlmGlobal

OK = {
    "choices": [{"message": {"content": json.dumps({"title": "Wniosek testowy"})}, "finish_reason": "stop"}],
    "usage": {},
}


def _client(handler, **kw):
    return LlmClient("http://fake", "m", timeout=5, transport=httpx.MockTransport(handler), **kw)


def test_api_key_sent_as_bearer_and_json_schema_first():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["auth"] = req.headers.get("authorization")
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json=OK)

    out = _client(handler, api_key="sk-test").complete("sys", "user", LlmGlobal)
    assert out.title == "Wniosek testowy"
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["response_format"]["type"] == "json_schema"


def test_provider_rejecting_json_schema_gets_portable_retry_and_fenced_json_is_accepted():
    bodies = []

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content)
        bodies.append(body)
        if body["response_format"]["type"] == "json_schema":
            return httpx.Response(400, json={"error": "response_format json_schema not supported"})
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '```json\n{"title": "Z chmury"}\n```'}, "finish_reason": "stop"}]
            },
        )

    c = _client(handler)
    assert c.complete("sys", "user", LlmGlobal).title == "Z chmury"
    assert [b["response_format"]["type"] for b in bodies] == ["json_schema", "json_object"]
    assert "schematem" in bodies[1]["messages"][0]["content"]
    assert "cache_prompt" not in bodies[1]
    c.complete("sys", "user", LlmGlobal)  # stays portable afterwards
    assert bodies[2]["response_format"]["type"] == "json_object"


def test_auth_failure_and_5xx_are_unavailable():
    for status in (401, 503):
        c = _client(lambda req, s=status: httpx.Response(s, text="x"))
        with pytest.raises(LlmUnavailable):
            c.complete("sys", "user", LlmGlobal)


def test_chain_falls_back_to_local_and_skips_dead_endpoint():
    calls = []

    def dead(req):
        calls.append("cloud")
        raise httpx.ConnectError("no route")

    def local(req):
        calls.append("local")
        return httpx.Response(200, json=OK)

    chain = ChainedClient([_client(dead), _client(local)])
    assert chain.complete("s", "u", LlmGlobal).title == "Wniosek testowy"
    chain.complete("s", "u", LlmGlobal)
    assert calls == ["cloud", "local", "local"]
    assert all(c["endpoint"] == "http://fake" for c in chain.calls)


def test_disk_cache_skips_the_model_on_identical_prompt(tmp_path):
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(200, json=OK)

    c = _client(handler, cache_dir=tmp_path)
    assert c.complete("sys", "user", LlmGlobal).title == "Wniosek testowy"
    assert c.complete("sys", "user", LlmGlobal).title == "Wniosek testowy"
    c.complete("sys", "other user", LlmGlobal)
    assert len(calls) == 2 and c.cache_hits == 1
    assert len(list(tmp_path.glob("*.json"))) == 2


def test_disk_cache_not_written_for_invalid_answer(tmp_path):
    bad = {"choices": [{"message": {"content": "{not json"}, "finish_reason": "length"}]}
    c = _client(lambda req: httpx.Response(200, json=bad), cache_dir=tmp_path)
    with pytest.raises(ValueError):
        c.complete("sys", "user", LlmGlobal)
    assert list(tmp_path.glob("*.json")) == []


def test_make_client_passes_cache_dir_from_settings(tmp_path):
    from formgen.config import Settings
    from formgen.extract.llm_client import make_client

    c = make_client(Settings(_env_file=None, llm_cache_dir=str(tmp_path), llm_fallback_base_url="http://local"))
    assert all(cl.cache_dir == tmp_path for cl in c.clients)
    assert make_client(Settings(_env_file=None)).cache_dir is None
