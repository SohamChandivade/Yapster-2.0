# Yapster

Practise German by **talking** to Lena, an AI tutor who speaks only German, drops you into real situations (bakery, train ticket, landlord, job interview), never interrupts to correct you, and gives you the notes afterwards. Built for one learner's daily use on a phone.

- **Live app:** https://yapster-2-0.vercel.app
- **API health:** https://yapster-2-0.onrender.com/health
- Both run on free tiers. After about 15 idle minutes the first request takes up to a minute to wake the server; after that it is quick.

The product brief, design rules and every technical decision live in [`CLAUDE.md`](CLAUDE.md). The build log is [`PROGRESS.md`](PROGRESS.md). Open tasks are on the [issues page](https://github.com/UjjwalArote69/Yapster-2.0/issues); the [Starter pack](https://github.com/UjjwalArote69/Yapster-2.0/milestone/1) milestone collects the small ones, each with a "How to solve it" comment.

---

## Contents

1. [What is in the box](#what-is-in-the-box)
2. [Set up on your machine, step by step](#set-up-on-your-machine-step-by-step)
3. [Everyday commands](#everyday-commands)
4. [Try it on your phone](#try-it-on-your-phone)
5. [Project layout](#project-layout)
6. [How a conversation works](#how-a-conversation-works)
7. [Troubleshooting](#troubleshooting)
8. [Deploy](#deploy-all-free-vercel--render--neon)
9. [Contributing](#contributing)

---

## What is in the box

| Part | Folder | Stack |
|---|---|---|
| Web app (the thing you use) | `web/` | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Zustand. Installable as a PWA. |
| API | `api/` | FastAPI on Python 3.12, SQLAlchemy 2 (async), Alembic migrations, Pydantic v2. |
| Database | Neon (hosted) or Docker | PostgreSQL with the `pgvector` extension. |
| Language models | free tiers | Gemini Flash first, Groq and Mistral as fallbacks. Called over plain HTTPS; keys go in `.env`. |
| Speech | in the browser | Web Speech API for listening (`de-DE`) and speaking. No audio touches the server. |

You do **not** need a GPU, a paid account, or a Google Cloud project to run it.

---

## Set up on your machine, step by step

Written for someone who has never run the project. Windows (PowerShell), macOS and Linux are all fine; where a command differs it is shown for each.

### Step 0. Install the tools

Check what you already have by running each command in a terminal. If it prints a version, skip that install.

| Tool | Check | Install |
|---|---|---|
| **Git** | `git --version` | https://git-scm.com/downloads |
| **Node.js 20 or newer** (comes with npm) | `node -v` | https://nodejs.org (pick the LTS installer) |
| **uv** (installs Python 3.12 for you and manages the API's packages) | `uv --version` | Windows PowerShell: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"`  <br> macOS/Linux: `curl -LsSf https://astral.sh/uv/install.sh \| sh` <br> then open a **new** terminal |
| **Docker Desktop** (optional, see Step 3) | `docker --version` | https://www.docker.com/products/docker-desktop/ |

You do not need to install Python yourself. The first `uv sync` downloads Python 3.12 into the project.

### Step 1. Get the code

```sh
git clone https://github.com/UjjwalArote69/Yapster-2.0.git
cd Yapster-2.0
```

(The repository is private: you need to be added as a collaborator first, and `git clone` will ask you to sign in to GitHub.)

### Step 2. Get free API keys for the language models

Lena's replies come from hosted models. Create at least the first key; the other two are fallbacks for when the first one is rate-limited.

| Provider | Where to get a key | Cost |
|---|---|---|
| Google Gemini (primary) | https://aistudio.google.com/apikey → "Create API key" | free tier |
| Groq (fallback for live chat) | https://console.groq.com/keys | free tier |
| Mistral (fallback for recaps) | https://console.mistral.ai/api-keys | free "Experiment" plan |

Keep the keys for Step 4.

### Step 3. Choose a database

The API needs PostgreSQL with the `pgvector` extension. Pick **one**:

**Option A, Docker (everything on your laptop).** Start Docker Desktop, then from the repository root:

```sh
docker compose up -d db
docker compose ps        # wait until the db service says "healthy"
```

This runs Postgres on `localhost:5432` with user, password and database all set to `yapster`. The default `DATABASE_URL` in `.env.example` already points at it.

**Option B, Neon (hosted, free, no Docker).** Go to https://neon.tech, create a project (Postgres 16, nearest region). In the connect dialog turn **Connection pooling off** and copy the connection string. It looks like `postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require&channel_binding=require`. Use it as `DATABASE_URL` in Step 4; the API accepts it exactly as given.

You can switch later by changing one line in `.env`. Docker is still needed to run the API test suite (Step 8), because the tests create and wipe a throwaway database.

### Step 4. Create your `.env`

The repository ships a template. Copy it to `.env` in the repository root:

```sh
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` in any editor and fill in:

```ini
# Option A (Docker): leave this line as it is.
# Option B (Neon): paste the Neon connection string instead.
DATABASE_URL=postgresql+asyncpg://yapster:yapster@localhost:5432/yapster

GEMINI_API_KEY=paste-your-key
GROQ_API_KEY=paste-your-key-or-leave-empty
MISTRAL_API_KEY=paste-your-key-or-leave-empty
```

Leave everything else at its default. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` stay empty; the "Continue with Google" button hides itself and email sign-up works without them. `.env` is git-ignored and must never be committed.

### Step 5. Install and migrate the API

```sh
cd api
uv sync                       # downloads Python 3.12 and every package (first time: a minute or two)
uv run alembic upgrade head   # creates the tables in your database
```

`alembic upgrade head` should print four "Running upgrade" lines and exit without error. If it cannot connect, the database from Step 3 is not running or `DATABASE_URL` is wrong.

### Step 6. Start the API

Still in `api/`:

```sh
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000/health in a browser. You want `{"status":"ok","version":"0.1.0","db":true}`. If `db` is `false`, see [Troubleshooting](#troubleshooting).

Leave this terminal open. Do **not** add `--reload`: on Windows it stalls after the first reload. After changing API code, stop the server with Ctrl+C and start it again.

### Step 7. Start the web app

Open a **second** terminal in the repository root:

```sh
cd web
npm install        # first time only
npm run dev
```

Open http://localhost:3000. You should see the Welcome screen.

1. Tap **Get started**, use any email and a password of at least 8 characters.
2. Answer the five onboarding questions (name, how German feels, level, goals, confirmation). Pick **A0 "Just starting"** if you are a beginner; Lena then speaks in two-to-five-word sentences.
3. You land in the first conversation. Type a German line in the pill at the bottom and press Enter, or tap the microphone (Chrome and Edge support it on `localhost`). Tap **Hint** under any of Lena's lines when you are lost, or **Help me say this** when you know what you want to say in English.
4. Tap the back arrow and **See my recap** to get your notes, score and new words.

Both the API and the web terminal must stay open while you use the app.

### Step 8. Run the checks (before you open a pull request)

```sh
# API: unit tests, style, types. Needs the Docker database running for the database tests
# (they skip with a message otherwise). Tests never touch the database in DATABASE_URL;
# they use TEST_DATABASE_URL, which defaults to the Docker one.
cd api
uv run pytest -q
uv run ruff format --check .
uv run ruff check .
uv run mypy

# Web: lint, types, end-to-end flows at phone size (390×844) with the API mocked.
cd web
npx playwright install chromium   # once
npm run lint
npm run typecheck
npx playwright test
```

Playwright starts its own dev server if none is running on port 3000, and reuses yours if it is.

---

## Everyday commands

| Where | Command | What it does |
|---|---|---|
| root | `docker compose up -d db` | Start the local Postgres (Option A) |
| root | `docker compose down` | Stop it (data is kept in a Docker volume) |
| `api/` | `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` | Run the API |
| `api/` | `uv run alembic upgrade head` | Apply new migrations after pulling |
| `api/` | `uv run alembic revision -m "0005 short name"` | Create a migration after changing `app/db/models.py` |
| `api/` | `uv run alembic check` | Confirm models and migrations agree |
| `api/` | `uv run pytest -q` | API tests |
| `api/` | `uv run ruff format . && uv run ruff check . && uv run mypy` | Format, lint, type-check |
| `web/` | `npm run dev` | Web app on http://localhost:3000 |
| `web/` | `npm run lint && npm run typecheck` | Lint and type-check |
| `web/` | `npx playwright test` | End-to-end tests (`--ui` opens the inspector, `-g "hint"` filters by name) |
| `web/` | `npm run build && npm start` | Production build, as Vercel runs it |
| `web/` | `npm run certs` | Make a local HTTPS certificate for phone testing (see below) |
| `web/` | `npm run dev:https` | Web app on https://localhost:3443 for the phone |
| `web/` | `npm run icons` | Re-render the app icons from the Blob SVG |
| `web/` | `npm run smoke:sw` | Check the offline service worker against a production build |

---

## Try it on your phone

**Typing only (quick).** Phone and laptop on the same Wi-Fi. Find the laptop's address (`ipconfig` on Windows, look for "IPv4 Address"; `ipconfig getifaddr en0` on macOS). On the phone open `http://<laptop-ip>:3000`. The web app calls the API on the same address, port 8000, automatically.

**With the microphone.** Browsers only allow the microphone on HTTPS, so run the local HTTPS pair:

```sh
cd web
npm run certs        # once per network: makes a tiny local CA and a certificate for your LAN address
npm run dev:https    # https://<laptop-ip>:3443

# second terminal
cd api
uv run uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile ../certs/dev-key.pem --ssl-certfile ../certs/dev-cert.pem
```

On the phone, first open `https://<laptop-ip>:3443/yapster-dev-ca.pem` and install it as a CA certificate (Android: Settings → Security → Install a certificate → CA certificate; iPhone: open the file, install the profile, then Settings → General → About → Certificate Trust Settings). Then open `https://<laptop-ip>:3443`.

**Or skip all of that** and use the hosted app at https://yapster-2-0.vercel.app, which is HTTPS already. On Profile, "Add to Home Screen" installs it like an app.

---

## Project layout

```
Yapster-2.0/
├── CLAUDE.md             the brief: screens, design system, architecture, decisions log
├── PROGRESS.md           what was built when, and why
├── .env.example          every setting, with comments; copy to .env
├── docker-compose.yml    db (Postgres + pgvector), api, web
├── render.yaml           Render blueprint for the hosted API
├── api/
│   ├── app/
│   │   ├── main.py           FastAPI app, CORS
│   │   ├── config.py         Settings (read from .env / environment)
│   │   ├── routers/          auth, users (/me, /onboarding), sessions, scenarios, dashboard, progress, vocab, health
│   │   ├── services/         session loop, recap, corrections, dashboard, progress, auth, oauth
│   │   ├── llm/              provider adapters (Gemini, Groq, Mistral), prompts, streaming JSON extractor
│   │   ├── db/               models, engine, Alembic migrations
│   │   ├── schemas/          Pydantic request/response models
│   │   └── scenarios.py      the scenario scripts Lena plays
│   ├── tests/                pytest; conftest.py has the fake LLM and the throwaway test database
│   ├── start.sh              container entrypoint (migrate, then serve)
│   └── pyproject.toml
└── web/
    ├── app/                  Next.js routes: welcome, login, register, onboarding, (tabs)/{home,scenarios,progress,profile}, talk, recap, offline
    ├── components/           ui/ (Blob, GlassCard, Pill, Sheet, …), talk/, home/, progress/, scenarios/, profile/, pwa/
    ├── lib/                  api client, auth cookies, talk store, speech (recognition + synthesis)
    ├── public/               service worker, icons
    ├── scripts/              dev certificates, icon rendering, service worker smoke test
    ├── styles/globals.css    design tokens
    ├── middleware.ts         route guard (signed out → /welcome, not onboarded → /onboarding)
    └── tests/                Playwright flows at 390×844, API mocked in mockApi.ts
```

---

## How a conversation works

1. The web app calls `POST /sessions` with a scenario. The API builds Lena's system prompt (level, scenario script, what she knows about you) and asks the model for an opening line.
2. You speak or type. The browser turns speech into text (Web Speech API) and sends the text to `POST /sessions/{id}/turn`.
3. The API streams Lena's reply as server-sent events. It asks the model for one JSON object: the German reply, an English translation, a difficulty signal, silent corrections, new vocabulary. The reply text is extracted from the stream as it arrives, so you hear the first sentence before the JSON is complete.
4. The browser speaks each sentence as it completes (`speechSynthesis`). Corrections are stored but not shown; a small "notes" counter grows.
5. When you end the session, `POST /sessions/{id}/end` runs a second model call over the transcript: fluency score, positives, a next step, and the ranked notes you see on the recap.

Every model call goes through `api/app/llm/client.py`, which tries the providers in `LLM_CHAT_CHAIN` / `LLM_BATCH_CHAIN` in order and logs tokens and latency to the `llm_calls` table.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `/health` says `"db": false` | The database is not reachable. Option A: `docker compose ps` must show `db` as healthy; start Docker Desktop and `docker compose up -d db`. Option B: check `DATABASE_URL` in `.env`; Neon pauses after 5 idle minutes, so reload once. |
| `alembic upgrade head` fails with a connection error | Same as above. Also check you are in `api/` and that `.env` is in the repository root (one level up). |
| `python` opens the Microsoft Store, or `pip` is missing | Expected on Windows. Never call `python` directly; always `uv run <command>` inside `api/`. |
| API prints `Address already in use` on 8000 | An old server is still running. Windows: `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /T /F`. macOS/Linux: `lsof -i :8000` then `kill <pid>`. |
| Changed API code but nothing changes | The API does not auto-reload (see Step 6). Ctrl+C and start it again. |
| Web app shows "Could not reach the server. Is the API running?" | Start the API (Step 6). If it is running, open http://localhost:8000/health in the same browser; a certificate or firewall prompt may be blocking it. |
| Lena says "The tutor is unavailable right now" | Every provider in the chain failed. Usually a missing or wrong `GEMINI_API_KEY`, or the free quota is used up for the day; add a Groq key as fallback. The `llm_calls` table and the API log show the provider error. |
| Microphone button is missing | The browser has no `SpeechRecognition` (Firefox) or the page is not a secure context (`http://` on a phone). Use Chrome/Edge on `localhost`, or the HTTPS steps above, or the hosted app. |
| A "Tap to hear Lena" pill appears | Browsers block speech until you have tapped the page once. Tap it; it will not come back in that session. |
| Playwright says port 3000 is in use and times out | A dev server is already running; that is fine when it is yours. If it is a stray process, kill it as for port 8000 and run the tests again. |
| Playwright: "browser not found" | `npx playwright install chromium` once. |
| Tests say "Postgres not reachable", skipped | The API tests want the Docker database for the database-backed cases. Start it with `docker compose up -d db`; they pass without it, just fewer of them run. |
| Node version errors during `npm install` | You need Node 20 or newer; `node -v` to check, then install the LTS from nodejs.org. |

---

## Deploy (all free): Vercel + Render + Neon

| Piece | Where | Why |
|---|---|---|
| Web (`web/`) | **Vercel**, root directory `web` | Native Next.js hosting, HTTPS, PWA installable on the phone |
| API (`api/`) | **Render** web service, Docker, from `render.yaml` | Free instance; sleeps after 15 min idle, wakes on the first request (~30–60 s) |
| Postgres | **Neon** free tier | pgvector included and no expiry. Render's free Postgres is deleted after 30 days, so it is not used |

Deploy in this order; each step needs a URL from the previous one.

1. **Neon database.** [neon.tech](https://neon.tech) → New project → Postgres 16, region nearest you (the same region you will pick on Render). In the connect dialog switch **Connection pooling off** and copy the direct connection string (host without `-pooler`; the API keeps its own small pool, and the pooler's transaction mode fights asyncpg's prepared statements). Keep it for step 2; paste it exactly as given, the API rewrites `sslmode` for asyncpg. The same string works in the root `.env` for local development, so laptop, phone and the hosted app share one account and one memory. The first migration runs `CREATE EXTENSION IF NOT EXISTS vector`, which Neon allows.
2. **Render API.** [dashboard.render.com](https://dashboard.render.com) → New → Blueprint → connect the GitHub repo. Render reads `render.yaml` and asks for the secrets marked `sync: false`: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, and the Google client id/secret (leave both blank to hide the button). The container runs `api/start.sh`: migrations, then uvicorn on Render's `$PORT`. When the deploy is live, open `https://<service>.onrender.com/health` and check `"db": true`.
3. **Vercel web.** [vercel.com/new](https://vercel.com/new) → Import the repo → **Root Directory: `web`** (Framework preset Next.js is detected) → Environment variable `NEXT_PUBLIC_API_URL=https://<service>.onrender.com` → Deploy. Note the `https://<app>.vercel.app` URL. The variable is baked in at build time: change it and you must redeploy.
4. **Point the API at the web app.** On Render, set `PUBLIC_WEB_URL=https://<app>.vercel.app` and `PUBLIC_API_URL=https://<service>.onrender.com` (either edit the values in `render.yaml` and push, or change them in the service's Environment tab). Render redeploys. The web URL is also the CORS allow-list, so without it the browser blocks every API call; `CORS_ORIGINS` (a JSON list) is only for extra origins.
5. **Google sign-in (optional).** In Google Cloud Console add `https://<service>.onrender.com/auth/google/callback` as an authorized redirect URI. Because the hosted API is HTTPS, Google sign-in now works from the phone too.
6. **Phone.** Open the Vercel URL, sign in, Profile → "Add to Home Screen" (Android shows an Install button; iOS: Share → Add to Home Screen). The microphone works because Vercel is HTTPS; no certificates to install.

Every push to `main` redeploys both sides. Secrets live only in the Render and Vercel dashboards, never in the repo.

---

## Contributing

1. Pick an issue. The [Starter pack](https://github.com/UjjwalArote69/Yapster-2.0/milestone/1) issues are small and each has a "How to solve it" comment with the exact files and a test to write.
2. Branch from `main`: `feat/<short-name>` or `fix/<short-name>`. Commit messages look like `feat(talk): …` or `fix(api): …`.
3. Add or update a test with every change: API tests in `api/tests` (the LLM is faked in `conftest.py`), web flows in `web/tests` (the API is mocked in `mockApi.ts`).
4. Run the checks from Step 8, open a pull request, and describe how to test it.
5. New UI follows the design rules in `CLAUDE.md` §4: glass cards, pills, soft radial glows, one idea per screen, light theme first. Anything that changes how the app works gets a dated bullet in `CLAUDE.md` §11.
