# Multi-stage build pour optimiser le cache
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Image finale
FROM python:3.11-slim
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash appuser

WORKDIR /home/appuser/app
USER root

# Installer les dépendances
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*

# Copier le code
COPY . .
RUN chown -R appuser:appuser /home/appuser/app
RUN chmod +x /home/appuser/app/entrypoint.sh

USER appuser
EXPOSE 5000
ENTRYPOINT ["./entrypoint.sh"]