# One container for the judges' demo: the Next.js website is public on $PORT and the
# FastAPI evidence engine listens only on 127.0.0.1:8000 inside the container.

# ---- 1. Build the website -------------------------------------------------------------
FROM node:22.11.0-bookworm-slim AS web-build
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 2. Install the API --------------------------------------------------------------
FROM python:3.12.7-slim-bookworm AS api-build
WORKDIR /api
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir .

# ---- 3. Runtime ----------------------------------------------------------------------
FROM python:3.12.7-slim-bookworm
# Node runtime for the standalone Next.js server (same Debian base as the build stage).
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node

RUN useradd --create-home --uid 10001 ghost
WORKDIR /app

COPY --from=api-build /opt/venv /opt/venv
COPY --from=web-build --chown=ghost /web/.next/standalone ./web
COPY --from=web-build --chown=ghost /web/.next/static ./web/.next/static
COPY --chmod=755 deploy/start.sh ./start.sh
RUN mkdir -p /app/data && chown ghost /app/data

ENV PATH="/opt/venv/bin:$PATH" \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    API_URL=http://127.0.0.1:8000 \
    GP_STORAGE_DIR=/app/data/evidence \
    GP_CORS_ORIGINS=http://127.0.0.1 \
    PORT=10000

USER ghost
EXPOSE 10000
CMD ["./start.sh"]
