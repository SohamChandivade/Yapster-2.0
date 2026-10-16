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

# Voice on a phone needs HTTPS (microphone = secure context):
npm run certs                               # once per network; CA lands in web/public/
npm run dev:https                           # https://<laptop-ip>:3443
cd ../api && uv run uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile ../certs/dev-key.pem --ssl-certfile ../certs/dev-cert.pem
# On the phone: open https://<laptop-ip>:3443/yapster-dev-ca.pem, install it as a CA certificate, then open https://<laptop-ip>:3443
```
