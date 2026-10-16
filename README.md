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

## Deploy (all free): Vercel + Render + Neon

| Piece | Where | Why |
|---|---|---|
| Web (`web/`) | **Vercel**, root directory `web` | Native Next.js hosting, HTTPS, PWA installable on the phone |
| API (`api/`) | **Render** web service, Docker, from `render.yaml` | Free instance; sleeps after 15 min idle, wakes on the first request (~30–60 s) |
| Postgres | **Neon** free tier | pgvector included and no expiry. Render's free Postgres is deleted after 30 days, so it is not used |

Deploy in this order; each step needs a URL from the previous one.

1. **Neon database.** [neon.tech](https://neon.tech) → New project → Postgres 16, region nearest you (the same region you will pick on Render). In the connect dialog switch **Connection pooling off** and copy the direct connection string (host without `-pooler`; the API keeps its own small pool, and the pooler's transaction mode fights asyncpg's prepared statements). Keep it for step 2; paste it exactly as given, the API rewrites `sslmode` for asyncpg. The same string works in the root `.env` for local development, so laptop, phone and the hosted app share one account and one memory. The first migration runs `CREATE EXTENSION IF NOT EXISTS vector`, which Neon allows.
2. **Render API.** [dashboard.render.com](https://dashboard.render.com) → New → Blueprint → connect the GitHub repo. Render reads `render.yaml` and asks for the secrets marked `sync: false`: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, and the Google client id/secret (leave both blank to hide the button). The container runs `api/start.sh`: migrations, then uvicorn on Render's `$PORT`. When the deploy is live, open `https://<service>.onrender.com/health` and check `"db": true`.
3. **Vercel web.** [vercel.com/new](https://vercel.com/new) → Import the repo → **Root Directory: `web`** (Framework preset Next.js is detected) → Environment variable `NEXT_PUBLIC_API_URL=https://<service>.onrender.com` → Deploy. Note the `https://<app>.vercel.app` URL.
4. **Point the API at the web app.** On Render, set `PUBLIC_WEB_URL=https://<app>.vercel.app` and `PUBLIC_API_URL=https://<service>.onrender.com` (either edit the values in `render.yaml` and push, or change them in the service's Environment tab). Render redeploys. The web URL is also the CORS allow-list, so without it the browser blocks every API call; `CORS_ORIGINS` (a JSON list) is only for extra origins.
5. **Google sign-in (optional).** In Google Cloud Console add `https://<service>.onrender.com/auth/google/callback` as an authorized redirect URI. Because the hosted API is HTTPS, Google sign-in now works from the phone too.
6. **Phone.** Open the Vercel URL, sign in, Profile → "Add to Home Screen" (Android shows an Install button; iOS: Share → Add to Home Screen). The microphone works because Vercel is HTTPS; no certificates to install.

Every push to `main` redeploys both sides. Secrets live only in the Render and Vercel dashboards, never in the repo.
