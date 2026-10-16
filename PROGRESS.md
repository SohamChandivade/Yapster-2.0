# Yapster — Progress log

Running history of what was built, verified and decided. Newest day first.
Architectural decisions live in `CLAUDE.md` §11; this file is the narrative.

---

## 2026-10-16 (second session)

### Timeline

| # | Block | Outcome |
|---|---|---|
| 1 | Restart after Docker came back | Postgres healthy at migration head, Google credentials found in `.env`, both servers up |
| 2 | Google sign-in, live | First attempt failed with `redirect_uri_mismatch`; the user registered `http://localhost:8000/auth/google/callback` in Google Cloud Console and sign-in then worked end to end |
| 3 | Leaving a conversation | Talk had no way back. Added a Back button: an empty session is discarded (`DELETE /sessions/{id}`), otherwise a sheet offers recap / discard / keep talking. API 30 tests |
| 4 | Animated background | Glows drift and breathe on three staggered transform-only keyframe paths; off under reduced motion. First version did nothing because Tailwind drops dynamically-named utilities; now plain CSS classes |
| 5 | First commit | `14e2d92`, 135 files, pushed to the new private repo https://github.com/UjjwalArote69/Yapster-2.0 (created with the GitHub CLI). `.gitattributes` pins LF |
| 6 | Language question | Answered: the engine is language-agnostic, German lives in prompts, scenarios, a few UI strings and the speech code; plan for a per-language registry noted. Speech language is now a single constant |
| 7 | **Milestone 3, voice** | Tap-to-talk German recognition, replies spoken sentence by sentence while streaming, Blob pulses with speech and shows a listening ring, voice on/off persisted, "tap to hear" fallback when autoplay is blocked, text-only mode when recognition is missing |
| 8 | HTTPS for the phone | `npm run certs` builds a local CA + server cert for localhost and the LAN IPs; `npm run dev:https` on 3443 with the API on 8443; the client picks the API port from the page protocol. Chains verified with OpenSSL; a real Talk over HTTPS confirmed secure context, API on 8443, mic and voice controls, Lena's opening line |
| 9 | Second commit | `ce8eb6b`, 16 files, pushed. Web tests: 32 Playwright flows (4 voice flows with fake Web Speech APIs) |
| 10 | Shutdown | The user stopped all four dev servers (3000, 8000, 3443, 8443) |
| 12 | **Dashboard made fully live** | `GET /progress`, play counts on `/scenarios`, `open_session` on `/dashboard`; real Progress screen (calendar, weak-spot small multiples, vocabulary line, history) and Scenarios grid; Home links all work; unfinished talks can be continued or discarded. Chart colours validated with the dataviz script. API 32 tests, web 38 flows |
| 11 | **Hints for absolute beginners** | New `A0` level, `reply_en` in every tutor turn (stored in `messages.text_en_hint`), `POST /sessions/{id}/hint` with three suggested replies, Hint chip + sheet with listen/use buttons and a "show English under Lena's lines" mode. API 30 tests, web 33 flows |
| 13 | Hint chip that never disappears | Reported as "once I used it, it disappears". Live repro showed it coming back, but it was unmounted while a turn ran and a failed hint left the sheet blank. Now every tutor line keeps a chip (prominent on the latest, small on earlier ones), chips are disabled rather than removed while busy, each hint targets its own line by `message_id` (`opening_message_id` added to `POST /sessions`), and the sheet shows the error with Try again. API 32 tests, web 40 flows |
| 14 | Third commit | `53085bd`, hints, dashboard, Progress, Scenarios; pushed |
| 15 | **PWA + deploy prep** | Manifest, Blob icons rendered from SVG (`npm run icons`), small hand-written service worker (offline page, static-asset cache, never the API), install card on Profile, production build verified. `render.yaml` + `start.sh` for the API on Render, Neon for Postgres (Render free Postgres expires in 30 days), provider URL normalisation, README "Deploy" walkthrough. API 40 tests, web 44 flows |

### Verification at the second commit

| Check | Result |
|---|---|
| `api`: pytest / ruff / mypy strict / alembic check | 30 passed / clean / clean / no drift |
| `web`: eslint / tsc / Playwright | clean / clean / 32 passed |
| Google sign-in | completed live by the user from the laptop |
| HTTPS pair | both certificates verify against the local CA (OpenSSL return code 0) on localhost and on the hotspot address |
| Talk over HTTPS, real account, real LLM | `isSecureContext` true, API calls on 8443, mic and voice toggle rendered, no console errors |

### Still for the user to judge

- Real microphone on the phone (install `yapster-dev-ca.pem` as a CA, open `https://<laptop-ip>:3443`, allow the mic). The brief's open questions, whether the phone's German recognition and built-in German voice are good enough, are answered only by using it. Fallbacks ready if not: Groq's free Whisper for recognition, Piper for a nicer voice.

### Problems hit and fixed this session

- `redirect_uri_mismatch` from Google: the callback URI had not been registered in the Cloud Console.
- A `$'` sequence in a JavaScript replacement string duplicated half of a test file; the spec was rewritten from scratch.
- Backslashes in regex literals were lost when written through the shell; those lines are now edited with the file tool.
- The HTTPS Talk page first called the plain API port because an earlier edit had silently not applied; the port mapping was re-applied with the editor and re-verified.
- Windows curl refuses the local CA for lack of a revocation list; OpenSSL and browsers accept it.

### Next

1. Milestone 4, RAG and memory: grammar reference and scenario markdown, local embeddings, hybrid search, memory extraction at session end.
2. Milestone 5, remaining: editable Profile, placement chat for "Not sure", language field in onboarding (Scenarios and Progress screens are done).
3. Milestone 6: PWA manifest, haptics, offline transcript cache; Whisper/Piper if the browser speech disappoints.

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
