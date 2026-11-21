"""Pipeline entry point: validated bytes -> FormDefinition.

Stages (see docs/research/README.md):
  ingest (format -> document model) -> extract (FormSpec) -> compose (template) -> validate.
Extractors: ``llm`` (local llama.cpp, default), ``heuristic`` (layout signals only, also the
automatic fallback when the LLM sidecar is down or returns garbage) and ``stub`` (template only).
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Protocol

from formgen.api.settings import Settings
from formgen.compose import FormSpec, compose
from formgen.schema import FormDefinition, Severity, Violation, check_rules

log = logging.getLogger("formgen.pipeline")


@dataclass
class PipelineResult:
    form: FormDefinition
    violations: list[Violation]
    elapsed_ms: int
    trace: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not any(v.severity == Severity.ERROR for v in self.violations)


class Extractor(Protocol):
    def extract(self, data: bytes, kind: str, filename: str, settings: Settings) -> FormSpec: ...


class StubExtractor:
    """Template pages only; title from the file name. Used in tests and as a last resort."""

    def extract(self, data: bytes, kind: str, filename: str, settings: Settings) -> FormSpec:
        title = filename.rsplit(".", 1)[0].replace("_", " ").strip() or "Wniosek"
        return FormSpec(title=title, with_validators=settings.with_validators)


def default_extractor(settings: Settings) -> Extractor:
    if settings.extractor == "llm":
        from formgen.extract import LlmExtractor

        return LlmExtractor()
    if settings.extractor == "heuristic":
        from formgen.extract.heuristic import HeuristicExtractor

        return HeuristicExtractor()
    return StubExtractor()


def run(
    data: bytes, kind: str, filename: str, settings: Settings, extractor: Extractor | None = None
) -> PipelineResult:
    t0 = time.perf_counter()
    extractor = extractor or default_extractor(settings)
    trace: dict = {"kind": kind, "extractor": type(extractor).__name__}
    try:
        spec = extractor.extract(data, kind, filename, settings)
    except (ConnectionError, TimeoutError, ValueError) as exc:
        # LLM sidecar down, too slow or invalid output: degrade to the layout-only extractor, never fail the user
        if not settings.llm_fallback_heuristic or type(extractor).__name__ == "HeuristicExtractor":
            raise
        from formgen.extract.heuristic import HeuristicExtractor

        log.warning("extractor %s failed (%s); falling back to HeuristicExtractor", type(extractor).__name__, exc)
        spec = HeuristicExtractor().extract(data, kind, filename, settings)
        trace.update(extractor="HeuristicExtractor", fallback_reason=str(exc)[:200])
    form = compose(spec)
    violations = check_rules(form)
    return PipelineResult(form, violations, int((time.perf_counter() - t0) * 1000), trace)
