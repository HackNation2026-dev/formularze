"""Client for any OpenAI-compatible chat endpoint serving an *open* model.

Two deployments are supported with the same code, per the mentor's ruling (Discord 2026-11-21):
- local llama.cpp server in the compose network (default), JSON-schema grammar enforced server-side;
- a cloud endpoint hosting the same open model (LLM_BASE_URL + LLM_API_KEY). Providers that reject
  ``response_format: json_schema`` get a second attempt with ``json_object`` and the schema in the prompt.
``ChainedClient`` tries endpoints in order (cloud, then local) so a dead network never blocks a request.
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

import httpx
from pydantic import BaseModel

from formgen.extract.schema import json_schema

log = logging.getLogger("formgen.llm")
_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.S)


class LlmUnavailable(ConnectionError):
    pass


class LlmClient:
    def __init__(
        self,
        base_url: str,
        model: str = "",
        timeout: float = 300.0,
        temperature: float = 0.0,
        api_key: str = "",
        transport: httpx.BaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.temperature = temperature
        self.calls: list[dict[str, Any]] = []
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._http = httpx.Client(headers=headers, timeout=timeout, transport=transport)
        self._portable = False  # set after a provider rejects llama.cpp-specific fields

    def alive(self) -> bool:
        try:
            r = self._http.get(f"{self.base_url}/health", timeout=3.0)
            return r.status_code == 200
        except httpx.HTTPError:
            return False

    def _body(self, system: str, user: str, out: type[BaseModel], max_tokens: int, portable: bool) -> dict[str, Any]:
        schema = json_schema(out)
        body: dict[str, Any] = {
            "model": self.model or "local",
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": self.temperature,
            "max_tokens": max_tokens,
        }
        if portable:
            body["messages"][0]["content"] = (
                f"{system}\nOdpowiedz wyłącznie obiektem JSON zgodnym z tym schematem:\n{json.dumps(schema, ensure_ascii=False)}"
            )
            body["response_format"] = {"type": "json_object"}
        else:
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": out.__name__, "schema": schema, "strict": True},
            }
            body["cache_prompt"] = True
            body["chat_template_kwargs"] = {"enable_thinking": False}
        return body

    def _post(self, body: dict[str, Any]) -> httpx.Response:
        try:
            return self._http.post(f"{self.base_url}/v1/chat/completions", json=body)
        except httpx.ConnectError as exc:
            raise LlmUnavailable(f"LLM at {self.base_url} unreachable: {exc}") from exc
        except httpx.TimeoutException as exc:
            raise TimeoutError(f"LLM call exceeded {self.timeout}s") from exc

    def complete[T: BaseModel](self, system: str, user: str, out: type[T], max_tokens: int = 4096) -> T:
        t0 = time.perf_counter()
        r = self._post(self._body(system, user, out, max_tokens, self._portable))
        if r.status_code == 400 and not self._portable:
            # provider does not accept json_schema / llama.cpp fields: retry once in portable mode, then stay there
            log.info("provider rejected json_schema body (%s); switching to portable json_object mode", r.text[:120])
            self._portable = True
            r = self._post(self._body(system, user, out, max_tokens, True))
        if r.status_code in (401, 403):
            raise LlmUnavailable(f"LLM auth failed ({r.status_code}) at {self.base_url}")
        if r.status_code == 429 or r.status_code >= 500:
            raise LlmUnavailable(f"LLM error {r.status_code}: {r.text[:200]}")
        r.raise_for_status()
        data = r.json()
        content = _FENCE.sub("", data["choices"][0]["message"]["content"] or "")
        usage = data.get("usage", {})
        elapsed = time.perf_counter() - t0
        finish = data["choices"][0].get("finish_reason")
        self.calls.append(
            {
                "schema": out.__name__,
                "seconds": round(elapsed, 1),
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "finish": finish,
                "endpoint": self.base_url,
            }
        )
        log.info(
            "llm %s %.1fs tokens=%s/%s finish=%s",
            out.__name__,
            elapsed,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
            finish,
        )
        try:
            return out.model_validate(json.loads(content))
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"LLM returned invalid {out.__name__}: {exc}; content={content[:300]}") from exc


class ChainedClient:
    """Try endpoints in order; after one becomes unavailable it is skipped for the rest of the request."""

    def __init__(self, clients: list[LlmClient]):
        if not clients:
            raise ValueError("at least one client")
        self.clients = clients
        self._dead: set[int] = set()

    @property
    def calls(self) -> list[dict[str, Any]]:
        return [c for cl in self.clients for c in cl.calls]

    def alive(self) -> bool:
        return any(c.alive() for c in self.clients)

    def complete[T: BaseModel](self, system: str, user: str, out: type[T], max_tokens: int = 4096) -> T:
        last: Exception | None = None
        for i, client in enumerate(self.clients):
            if i in self._dead:
                continue
            try:
                return client.complete(system, user, out, max_tokens)
            except (LlmUnavailable, TimeoutError) as exc:
                log.warning("endpoint %s failed (%s); trying next", client.base_url, exc)
                self._dead.add(i)
                last = exc
        raise last or LlmUnavailable("no LLM endpoint available")


def make_client(settings: Any) -> LlmClient | ChainedClient:
    """Primary endpoint from LLM_BASE_URL (+ LLM_API_KEY), optional LLM_FALLBACK_BASE_URL (local llama.cpp)."""
    primary = LlmClient(
        settings.llm_base_url, settings.llm_model, settings.llm_timeout_seconds, api_key=settings.llm_api_key
    )
    if settings.llm_fallback_base_url:
        fallback = LlmClient(
            settings.llm_fallback_base_url,
            settings.llm_fallback_model or settings.llm_model,
            settings.llm_timeout_seconds,
        )
        return ChainedClient([primary, fallback])
    return primary
