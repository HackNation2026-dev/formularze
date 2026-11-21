"""Minimal client for a local llama.cpp server (OpenAI-compatible, JSON-schema constrained)."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx
from pydantic import BaseModel

from formgen.extract.schema import json_schema

log = logging.getLogger("formgen.llm")


class LlmUnavailable(ConnectionError):
    pass


class LlmClient:
    def __init__(self, base_url: str, model: str = "", timeout: float = 300.0, temperature: float = 0.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.temperature = temperature
        self.calls: list[dict[str, Any]] = []

    def alive(self) -> bool:
        try:
            r = httpx.get(f"{self.base_url}/health", timeout=3.0)
            return r.status_code == 200
        except httpx.HTTPError:
            return False

    def complete[T: BaseModel](self, system: str, user: str, out: type[T], max_tokens: int = 4096) -> T:
        schema = json_schema(out)
        body = {
            "model": self.model or "local",
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": self.temperature,
            "max_tokens": max_tokens,
            "cache_prompt": True,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": out.__name__, "schema": schema, "strict": True},
            },
            "chat_template_kwargs": {"enable_thinking": False},
        }
        t0 = time.perf_counter()
        try:
            r = httpx.post(f"{self.base_url}/v1/chat/completions", json=body, timeout=self.timeout)
        except httpx.ConnectError as exc:
            raise LlmUnavailable(f"LLM at {self.base_url} unreachable: {exc}") from exc
        except httpx.TimeoutException as exc:
            raise TimeoutError(f"LLM call exceeded {self.timeout}s") from exc
        if r.status_code >= 500:
            raise LlmUnavailable(f"LLM error {r.status_code}: {r.text[:200]}")
        r.raise_for_status()
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        elapsed = time.perf_counter() - t0
        self.calls.append(
            {
                "schema": out.__name__,
                "seconds": round(elapsed, 1),
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "finish": data["choices"][0].get("finish_reason"),
            }
        )
        log.info(
            "llm %s %.1fs tokens=%s/%s finish=%s",
            out.__name__,
            elapsed,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
            data["choices"][0].get("finish_reason"),
        )
        try:
            return out.model_validate(json.loads(content))
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"LLM returned invalid {out.__name__}: {exc}; content={content[:300]}") from exc
