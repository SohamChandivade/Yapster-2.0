FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/

WORKDIR /app
# Keep the venv outside /app so the dev bind mount does not shadow it.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .
EXPOSE 8000
# Migrates, then serves on $PORT (Render) or 8000. docker compose overrides this with --reload.
CMD ["sh", "start.sh"]
