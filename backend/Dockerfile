# ============================================================
# Muhai API image.
#
# Two stages. The builder carries the compilers that pandas, numpy and
# prophet need to install; the runtime carries only Tesseract and the
# finished virtualenv. That keeps the shipped image free of a C toolchain,
# which is both smaller and one less thing to patch on the VPS.
#
# The same image runs the API and the one-shot migration job — they differ
# only by the command compose gives them.
# ============================================================

# ── Stage 1: build the virtualenv ────────────────────────────────────
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# A virtualenv rather than the system site-packages: it copies to the runtime
# stage as a single self-contained directory.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt


# ── Stage 2: runtime ─────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# tesseract-ocr-tur is what makes the OCR read Turkish invoices; libpq5 is the
# runtime half of libpq-dev; curl backs the healthcheck below.
#
# The pango/cairo/gdk-pixbuf trio and fonts-dejavu-core are WeasyPrint's, and
# they belong in *this* stage rather than the builder: weasyprint is pure
# Python but binds them through cffi at import time, so the wheel installs fine
# without them and then fails at the first PDF. DejaVu is what carries the
# Turkish glyphs and the ₺ sign — without a font that has them, a report prints
# tofu boxes where the money should be.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-tur \
    libpq5 \
    curl \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi8 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Run as a normal user. Nothing here needs root, and a container that never
# needs it should never have it.
RUN useradd --create-home --uid 10001 muhai

COPY --chown=muhai:muhai . .

USER muhai

EXPOSE 8000

# Compose has its own healthcheck; this one makes the image self-describing so
# `docker run` and any other orchestrator get the same signal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
