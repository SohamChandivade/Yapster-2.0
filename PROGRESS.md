# Yapster — Progress log

Running history of what was built, verified and decided. Newest day first.
Architectural decisions live in `CLAUDE.md` §11; this file is the narrative.

---

## 2026-10-16 (second session)

- Google sign-in verified live by the user (after registering the redirect URI). First commit `14e2d92` pushed to the private repo https://github.com/UjjwalArote69/Yapster-2.0.
- Talk screen got a Back button: discards an empty session, or offers recap / discard / keep talking once something was said (`DELETE /sessions/{id}`).
- Background glows now drift and breathe (transform-only keyframes, off under reduced motion).
- **Milestone 3, voice**: tap-to-talk German speech recognition, replies spoken sentence by sentence while streaming, Blob pulsing with speech, voice on/off toggle, "tap to hear" fallback when the browser blocks autoplay, HTTPS dev pair (3443/8443) with a local CA so the phone may use the microphone. Web tests: 32 Playwright flows.

## 2026-10-15 → 2026-10-16 (first build session)

One long session, from an empty folder with a brief and five reference images to a
working product: landing → sign-in (email or Google) → onboarding → dashboard →
text conversation with a German tutor → recap. Everything below is uncommitted
(132 files); git is initialised on `main` with nothing committed yet.

### Timeline

| # | Block | Outcome |
|---|---|---|
| 1 | Read the brief, studied `design inspo/` | Mapped each image to a screen: 5 = Home, 3 = Blob + onboarding, 4 = glows + mixed-weight headline, 2 = glass cards, 1 = recap tiles |
| 2 | Milestone 1, skeleton | Next 15.5 + Tailwind 4 + framer-motion, FastAPI + SQLAlchemy async + Alembic, Docker Compose, design tokens, Blob/GlassCard/BottomNav, Home with fake data, tests |
| 3 | Design review | User saw dark mode (Windows dark) and disliked it. Light is now the default with a Light/Dark/Auto toggle; glows softened, hero card near-white, vivid scenario cards, ambient backdrop fixed to the viewport |
| 4 | Rename | Sprich → Yapster everywhere (app titles, package names, DB credentials, memory notes) |
| 5 | LLM providers | Keys for Gemini, Groq, Mistral verified with real calls; chains chosen and recorded |
| 6 | Milestone 2, text conversation | Seven tables + call log, provider-chain LLM client with streaming JSON, tutor/help/recap prompts, session routes with SSE, Talk screen, notes drawer, Help sheet, Recap screen. Real bakery and party conversations run through Gemini |
| 7 | Accounts, landing, onboarding | Email + password accounts, revocable tokens, route guard middleware, `/welcome`, `/login`, `/register`, five-step onboarding with reacting Blob, Profile with Log out |
| 8 | Google sign-in + real dashboard | OAuth 2.0 + PKCE through the API, account linking, `/dashboard` endpoint, Home with no fake data left |
| 9 | Shutdown | Dev servers stopped, this file written |

### What exists now

**Web (`web/`)** — Next 15.5, React 19, Tailwind 4.3, framer-motion, zustand, Playwright.
- Routes: `/welcome`, `/login`, `/register`, `/auth/callback`, `/onboarding`, `/` (dashboard), `/talk`, `/recap/[sessionId]`, `/profile`, `/scenarios` and `/progress` (placeholders until milestone 5).
- `middleware.ts` guards routes from two cookies (`yapster_token`, `yapster_onboarded`).
- Components: Blob (glossy sphere, face, blink, pulse), Glow, Backdrop, GlassCard, Pill family, StatTile, BottomNav, Sheet, ThemeToggle, GoogleButton, AuthScreen, OnboardingFlow, HomeScreen, ProfileScreen, TalkScreen (+ Transcript, TalkBar, NotesChip, DifficultyPill, HelpMeSayThis, CorrectionsDrawer), RecapScreen.
- `lib/api.ts` typed client incl. the SSE turn stream; `lib/auth.ts` cookies; `lib/talkStore.ts` zustand; `lib/theme*.ts` theme.
- Tests: 26 Playwright flows at 390×844 with the API mocked (`tests/mockApi.ts`), screenshots in `test-results/`.

**API (`api/`)** — FastAPI, Python 3.12 via uv, SQLAlchemy 2 async, Alembic, pgvector.
- Routes: `/health`, `/auth/{register,login,logout,providers,google/start,google/callback}`, `/onboarding`, `/me`, `/dashboard`, `/scenarios`, `/sessions` (+ `/{id}`, `/turn` SSE, `/help`, `/difficulty`, `/corrections`, `/end`, `/recap`), `/vocab/save`.
- Services: auth (argon2id + hashed tokens), oauth (Google), session (prompt building, streaming turn, corrections, difficulty), recap, correction ranking, vocab, dashboard.
- LLM layer: REST adapters for Gemini / Groq / Mistral, ordered fallback chains, JSON parsing, `ReplyExtractor` for streaming `reply_de`, every attempt logged to `llm_calls`.
- Migrations 0001–0004: pgvector, core tables, accounts + auth tokens, Google columns. `alembic check` reports no drift.
- Tests: 29 pytest (unit + full flows against a `yapster_test` database created on demand; LLM and Google mocked).

**Infra** — `docker-compose.yml` (db, api, web), `.env` holds Postgres creds, the three LLM keys, and the Google slots.

### Verification at shutdown

| Check | Result |
|---|---|
| `api`: pytest / ruff / mypy strict / alembic check | 29 passed / clean / clean / no drift |
| `web`: eslint / tsc / Playwright | clean / clean / 26 passed |
| Real LLM calls | Gemini 3.5 Flash-Lite for turns (~1.3 s), Gemini 3.8 Flash for recaps (falls back to Mistral 14B when it 503s), Groq verified as fallback |
| Live account cycle | register 201, duplicate 409, bad login 401, onboarding flips `onboarded`, logout 204 then 401 |
| Route guard | probed in every cookie state; assets pass through |
| Phone | app reachable at `http://<laptop-ip>:3000` over the phone's hotspot; API CORS accepts private origins |

### Decisions worth remembering (details in CLAUDE.md §11)

- Light theme is the default; dark exists but is secondary.
- Providers are called over plain REST, not SDKs. Chains are env-configurable.
- Gemini 3.x non-lite Flash "thinks" and those tokens count against the output cap; +2048 headroom.
- One LLM call per turn: JSON output, with `reply_de` extracted from the byte stream for streaming.
- Help-me-say-this lines are `assisted`: no corrections, not counted for fluency.
- Embeddings are `vector(384)` for `multilingual-e5-small`, not 1536.
- Accounts are self-hosted (no Clerk). Google sign-in only completes from the laptop until HTTPS exists (Google refuses LAN IPs).
- uvicorn runs without `--reload` on this machine (reload stalls); restart by hand after API changes.

### Problems hit and fixed

- Bash tool truncates commands over ~10k chars; big files go through the file tool.
- `python3` on this machine is a Microsoft Store stub that hangs; use `uv run python`.
- A failed `cd` once wrote API files into `web/`; all write scripts now start with `set -e`.
- `.env` was overwritten by the editor after the rename (old DB credentials); fixed and the database recreated.
- Gemini recap returned truncated JSON (thinking tokens); fixed with output headroom.
- Next 15.5 silently matched only `/` for a lookahead middleware matcher; replaced with `/:path*` plus in-code exclusions.
- Playwright `**/onboarding` route mock also caught the Next page; mocks pinned to the API origin.
- Dev-server first-visit compiles made URL assertions flake; `expect` timeout raised to 15 s.
- Python `SimpleCookie` quoted the OAuth cookie because the origin contains `/`; the origin is now percent-encoded.

### How to resume

```sh
# 1. Start Docker Desktop, then:
docker compose up -d --wait db

# 2. API (from api/)  — no --reload on this machine
uv run alembic upgrade head
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3. Web (from web/)
npm run dev          # http://localhost:3000 ; phone: http://<laptop wifi ip>:3000 (ipconfig)

# Checks
cd api && uv run pytest -q && uv run ruff check . && uv run mypy && uv run alembic check
cd web && npm run lint && npm run typecheck && npx playwright test
```

Google sign-in: put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, register
`http://localhost:8000/auth/google/callback` as an authorized redirect URI in Google Cloud
Console, restart the API, then press "Continue with Google" at http://localhost:3000.

### Open items / next

1. First git commit (nothing committed yet).
2. Live Google click-through once credentials are in `.env` (needs the user's browser).
3. Milestone 3: mic + Web Speech recognition (`de-DE`), sentence-by-sentence TTS, Blob pulse synced to speech, HTTPS dev server so the phone may use the microphone (also unlocks Google sign-in on the phone).
4. Milestone 4: RAG (grammar + scenario markdown, hybrid search, memory extraction at session end).
5. Milestone 5: Scenarios grid, Progress charts, editable Profile, placement chat for "Not sure".
6. Milestone 6: PWA manifest, haptics, offline transcript cache.
7. Hardening: login rate limiting, email verification, Piper/faster-whisper if browser voices disappoint.
