# syntax=docker/dockerfile:1.7
# API image: official python slim, pinned (R-10..R-13). No model weights inside (mounted at runtime).
# UI vendor assets (PDF.js, JSONata) pinned in package-lock.json; built here so the image needs no network at runtime
FROM node:22.23.1-alpine3.24 AS ui
WORKDIR /ui
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund
COPY scripts/ui-assets.mjs ./scripts/
RUN node scripts/ui-assets.mjs

FROM python:3.14.4-slim-trixie AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# tesseract (Apache-2.0) + Polish data for the CPU OCR fallback
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-pol \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --create-home --shell /usr/sbin/nologin app

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY pyproject.toml README.md ./
COPY src ./src
COPY --from=ui /ui/src/formgen/static/review/vendor ./src/formgen/static/review/vendor
RUN pip install --no-deps . && rm -rf build src/*.egg-info

# magika ships its ONNX model inside the wheel and Tesseract data comes from apt: nothing is downloaded at runtime
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status==200 else 1)"
CMD ["python", "-m", "formgen"]
