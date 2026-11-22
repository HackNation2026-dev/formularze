"""Runtime configuration (R-07, R-15, R-16). Every value comes from the environment / .env."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Cyfryzacja formularzy"
    app_port: int = 8000
    log_level: str = "INFO"

    # upload validation
    max_upload_size_mb: int = Field(default=25, ge=1)
    allowed_extensions: str = "pdf,doc,docx,ods,xlsx,jpg,jpeg,png"
    max_filename_length: int = 250
    forbidden_filename_chars: str = ";:<>/\\|'*%$"
    request_timeout_seconds: int = 1800  # per file, also inside a batch
    max_batch_files: int = Field(default=20, ge=1)

    # auth
    auth_enabled: bool = True
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_issuer: str | None = None
    jwt_audience: str | None = None
    jwt_leeway_seconds: int = 30

    # LLM endpoint: any OpenAI-compatible server hosting an OPEN model (local llama.cpp by default; a cloud
    # deployment of the same open model is allowed per the mentor's ruling). LLM_FALLBACK_BASE_URL = local backup.
    llm_base_url: str = "http://llm:8080"
    llm_model: str = "qwen3.5-4b"
    llm_api_key: str = ""  # runtime secret, never baked into the image
    llm_fallback_base_url: str | None = None
    llm_fallback_model: str | None = None
    llm_cache_dir: str = ""  # evaluation only: cache model answers on disk (never set in production)
    # one chunk on a CPU-only box can take minutes; after this the heuristic extractor takes over
    llm_timeout_seconds: int = 600
    # context of ONE server slot (llama.cpp -c / -np); prompt + answer of a chunk call must fit in it
    llm_context_tokens: int = 8192
    # LLM calls of one form in flight at once (global + chunks); llama.cpp batches their decode steps into one pass
    # over the weights. Keep llm_parallel * llm_context_tokens <= the server's --ctx-size (shared KV pool).
    llm_parallel: int = 2
    # prefill the instruction prefixes on the LLM server once at API start (compose turns it on)
    llm_warm_up: bool = False
    ocr_backend: str = "tesseract"  # tesseract | rapidocr | unlimited
    ocr_base_url: str | None = None
    doc_converter_url: str | None = None  # Apache Tika sidecar for .doc

    # pipeline behaviour
    extractor: str = "llm"  # llm | heuristic | stub
    llm_fallback_heuristic: bool = True
    with_validators: bool = True
    with_dictionaries: bool = True
    with_dependencies: bool = True

    @property
    def allowed_ext_set(self) -> frozenset[str]:
        return frozenset(e.strip().lower() for e in self.allowed_extensions.split(",") if e.strip())

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
