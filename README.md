# Yapster

Conversational German practice. See `CLAUDE.md` for the full brief.

## Run everything (Docker)

```sh
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000 (register an account, answer five onboarding questions, then talk)
- API: http://localhost:8000/health
- Postgres with pgvector on :5432

## Run pieces natively

```sh
# API
cd api
uv sync
uv run uvicorn app.main:app --host 0.0.0.0  # http://localhost:8000 (no --reload: it stalls on Windows)
uv run alembic upgrade head                 # needs Postgres running
uv run pytest && uv run ruff check . && uv run mypy

# Web
cd web
npm install
npm run dev                                 # http://localhost:3000
npm run lint && npm run typecheck
npx playwright install chromium             # once
npm run test:e2e                            # 390×844 mobile flows
```
