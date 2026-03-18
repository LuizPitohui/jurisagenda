# =============================================================================
# JurisAgenda Backend — Dockerfile
# Multi-stage: builder instala deps, runner executa em imagem slim.
# =============================================================================

# ---- Stage 1: Builder ----
FROM python:3.12-slim AS builder

WORKDIR /app

# Dependências de sistema para psycopg2 e Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Instala Poetry
RUN pip install --no-cache-dir poetry==1.8.2

COPY pyproject.toml poetry.lock* ./

# Configura Poetry e instala dependências no sistema (sem venv)
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --without dev

# ---- Stage 2: Runner ----
FROM python:3.12-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=core.settings.production

WORKDIR /app

# Dependências de runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    clamav \
    clamav-daemon \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia pacotes instalados do builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copia código
COPY . .

# Cria usuário não-root
RUN addgroup --system app && adduser --system --ingroup app app
RUN chown -R app:app /app
USER app

# Collectstatic (sem DB — apenas arquivos estáticos)
RUN python manage.py collectstatic --noinput --settings=core.settings.production || true

EXPOSE 8000

# Entrypoint: gunicorn com workers uvicorn para ASGI (Channels)
CMD ["gunicorn", "core.asgi:application", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
