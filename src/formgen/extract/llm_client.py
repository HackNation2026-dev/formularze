"""Client for any OpenAI-compatible chat endpoint serving an *open* model.

Two deployments are supported with the same code, per the mentor's ruling (Discord 2026-11-21):
- local llama.cpp server in the compose network (default), JSON-schema grammar enforced server-side;
- a cloud endpoint hosting the same open model (LLM_BASE_URL + LLM_API_KEY). Providers that reject
  ``response_format: json_schema`` get a second attempt with ``json_object`` and the schema in the prompt.
``ChainedClient`` tries endpoints in order (cloud, then local) so a dead network never blocks a request.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from pathlib import Path
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
        cache_dir: str | os.PathLike[str] | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        # optional response cache for evaluation loops: identical prompt+schema+model -> identical answer, no model call
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.cache_hits = 0
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

    def _cache_path(self, system: str, user: str, out: type[BaseModel], max_tokens: int) -> Path | None:
        if self.cache_dir is None:
            return None
        key = json.dumps(
            [self.model, self.temperature, max_tokens, out.__name__, json_schema(out), system, user],
            ensure_ascii=False,
            sort_keys=True,
        )
        return self.cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()}.json"

    def complete[T: BaseModel](self, system: str, user: str, out: type[T], max_tokens: int = 4096) -> T:
        cache = self._cache_path(system, user, out, max_tokens)
        if cache is not None and cache.exists():
            self.cache_hits += 1
            self.calls.append({"schema": out.__name__, "seconds": 0.0, "cached": True, "endpoint": self.base_url})
            return out.model_validate(json.loads(cache.read_text(encoding="utf-8")))
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
                "timings": data.get("timings") or {},
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
            parsed = out.model_validate(json.loads(content))
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"LLM returned invalid {out.__name__}: {exc}; content={content[:300]}") from exc
        if cache is not None:  # store only answers that parsed; a truncated one must be retried next time
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(parsed.model_dump_json(), encoding="utf-8")
        return parsed


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
    """Primary endpoint from LLM_BASE_URL (+ LLM_API_KEY), optional LLM_FALLBACK_BASE_URL (local llama.cpp).

    LLM_CACHE_DIR (evaluation only) caches parsed answers on disk for both endpoints."""
    cache = getattr(settings, "llm_cache_dir", "") or None
    primary = LlmClient(
        settings.llm_base_url,
        settings.llm_model,
        settings.llm_timeout_seconds,
        api_key=settings.llm_api_key,
        cache_dir=cache,
    )
    if settings.llm_fallback_base_url:
        fallback = LlmClient(
            settings.llm_fallback_base_url,
            settings.llm_fallback_model or settings.llm_model,
            settings.llm_timeout_seconds,
            cache_dir=cache,
        )
        return ChainedClient([primary, fallback])
    return primary
