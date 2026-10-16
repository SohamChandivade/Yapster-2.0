# Yapster — Conversational German Practice App

> Project brief for Claude Code. Read this fully before writing any code.
> The project is called "Yapster".

---

## 1. What this is

A mobile-first web app where the user practises German by **talking to an AI tutor like a real person**, not by doing lessons. The tutor remembers the user across sessions, adapts difficulty automatically, corrects gently *after* the conversation, and drops the user into realistic scenarios (ordering at a bakery, arguing with a landlord, small talk at a party).

The user is the first customer. Build for one person's daily use first; multi-user comes later.

**Not** a Duolingo clone. No lesson tree, no XP spam, no hearts. One idea per screen.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js 15** (App Router, TypeScript) | Mobile-first. Treat it as a PWA. Desktop is not a target. |
| Styling | **Tailwind CSS v4** + CSS variables | Design tokens live in `globals.css`. No component library that fights the glass aesthetic. |
| Animation | **Framer Motion** | Blob pulsing, fade-ins, drawer sheets. |
| State | React Server Components + **Zustand** for client session state | Keep it light. |
| Backend | **FastAPI** (Python 3.12) | Async everywhere. Pydantic v2 models. |
| DB | **PostgreSQL** + **pgvector** | One DB for relational data and embeddings. |
| ORM | **SQLAlchemy 2.0 async** + Alembic | |
| LLM | **Google Gemini Flash** (free tier) via `google-genai` SDK | Provider-agnostic wrapper in `app/llm/`. Groq (free) as fallback for live chat; Mistral free tier for slow batch jobs (recap, memory extraction). **Budget: $0.** |
| Embeddings | **Local `sentence-transformers`** (`BAAI/bge-m3` or `intfloat/multilingual-e5-small`) | CPU is fine. Wrap in `app/rag/embedder.py`; config-driven. |
| STT | **Browser Web Speech API** (`SpeechRecognition`, lang `de-DE`) | Runs on the phone, free. v2: `faster-whisper` `small` locally in FastAPI if accuracy is poor. |
| TTS | **Browser `speechSynthesis`** (German voice) | Free, zero latency. v2: **Piper** (`de_DE-thorsten-high`) served from FastAPI for a nicer voice. |
| Auth | Single-user for v1: a long-lived token in `.env`. Add Clerk/Auth.js in v2. | |
| Infra | Docker Compose: `web`, `api`, `db` | |

---

## 3. Repo layout

```
yapster/
├── CLAUDE.md                 # this file
├── docker-compose.yml
├── web/                      # Next.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Home
│   │   ├── onboarding/
│   │   ├── talk/             # Conversation screen
│   │   ├── scenarios/
│   │   ├── recap/[sessionId]/
│   │   └── profile/
│   ├── components/
│   │   ├── ui/               # GlassCard, Pill, Blob, BottomNav, StatTile
│   │   └── talk/             # VoiceOrb, Transcript, HelpMeSayThis, CorrectionsDrawer
│   ├── lib/                  # api client, audio helpers
│   └── styles/globals.css    # design tokens
└── api/                      # FastAPI
    ├── app/
    │   ├── main.py
    │   ├── config.py
    │   ├── db/               # engine, session, models, migrations
    │   ├── routers/          # sessions, messages, scenarios, memory, speech
    │   ├── llm/              # client wrapper, prompts, difficulty logic
    │   ├── rag/              # chunking, embedder, retriever, ingest scripts
    │   ├── speech/           # stt.py, tts.py
    │   └── services/         # session_service, correction_service, memory_service
    ├── data/                 # grammar reference, scenario scripts (markdown)
    ├── tests/
    └── pyproject.toml
```

---

## 4. Design system (this matters a lot)

The look is **Apple-ish, soft gradients, glassmorphism**. References: Veri glucose app, Nextly, "Memories" app, blob-face onboarding. If in doubt: more air, bigger type, fewer elements.

### Tokens (`globals.css`)

```css
:root {
  /* Glow palette — warm is default, cool is for stats/recap */
  --glow-peach:  #FFB38A;
  --glow-lilac:  #C9B6FF;
  --glow-rose:   #FF9EC4;
  --glow-sky:    #9FC9FF;
  --glow-mint:   #B8E8D6;

  --bg:          #F7F5F2;
  --ink:         #1C1B1A;
  --ink-muted:   #8A8785;
  --glass:       rgba(255,255,255,0.68);
  --glass-border: rgba(255,255,255,0.75);

  --radius-card: 28px;
  --radius-pill: 999px;
  --blur:        24px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0E0E10;
    --ink: #F3F1EE;
    --ink-muted: #8E8B88;
    --glass: rgba(28,28,32,0.62);
    --glass-border: rgba(255,255,255,0.10);
  }
}
```

### Rules

- **Gradients are radial glows, never flat two-stop fills.** Implement as absolutely-positioned blurred circles (`filter: blur(60px)`) behind content, bleeding off screen edges.
- **Glass cards**: `background: var(--glass); backdrop-filter: blur(var(--blur)); border: 1px solid var(--glass-border); border-radius: var(--radius-card);` and **almost no shadow**. Depth comes from blur, not drop shadows.
- **Typography**: Inter or SF-like sans. Headlines 32–40px, weight 300–400. Mixed weights within one line allowed ("Smarter decisions, **made easy**"). Labels 11–12px, `--ink-muted`, uppercase-free.
- **Everything is a pill**: buttons, chips, the floating bottom nav. No sharp rectangles.
- **One idea per screen.** Onboarding is one question per screen, never a form.
- **Safe areas**: use `env(safe-area-inset-*)`. Bottom nav floats inside a glass pill above the home indicator.
- **The Blob**: a reusable `<Blob />` component — blurred radial gradient circle with optional face (two dots + mouth path). It pulses when the tutor speaks, shifts color with mood/difficulty, and is the app's mascot. Props: `size`, `palette`, `expression`, `speaking`.
- **Motion**: 200–350ms ease-out for everything. Drawers spring up from the bottom. No bounce on buttons.

---

## 5. Screens

### 5.1 Onboarding (`/onboarding`)
One question per screen, Blob reacts to the answer.
1. "What should I call you?"
2. "How does speaking German feel right now?" — Terrifying / Awkward / Fine / Pretty good
3. "What's your level?" — A1 / A2 / B1 / B2 (with a "not sure, let's find out" option that starts a 2-min placement chat)
4. "What do you need German for?" — Work / Living in Germany / Travel / Exams / Just because
5. "Thanks for being honest." → short summary of the plan → "Start talking"

Stores a `UserProfile`. Seeds the memory store with these facts.

### 5.2 Home (`/`)
- Greeting: "Hallo, {name}" + small line like "Day 12 · last session 8 min"
- Hero glass card: tutor name + orb avatar, next session suggestion, last session length, **"Start talking →"**
- Row of small stat tiles: streak, words owned, weak spot of the week
- "Pick a scenario" horizontal scroller (blurred photo cards)
- Floating bottom nav: Home · Scenarios · Progress · Profile

### 5.3 Talk (`/talk`)
The core screen. **No chat bubbles.**
- Large Blob centred, pulsing while tutor speaks.
- Transcript fades in as light text below (tutor lines + user lines, muted). Scrollable.
- Bottom glass pill: 🎙 mic (hold-to-talk or tap-to-toggle), **"Help me say this"**, ✕ end.
- "Help me say this": a small sheet where the user types English, gets the German, taps to insert/speak it; conversation continues as if nothing happened.
- Corrections do **not** appear inline. A subtle counter chip ("3 notes") grows top-right; tapping it opens a drawer with notes so far.
- Difficulty indicator: a tiny slider the user can nudge, but the system adjusts automatically.

### 5.4 Scenarios (`/scenarios`)
Grid of full-bleed blurred image cards, title lower-left: Bakery, Train ticket, Doctor, Landlord, Party small talk, Job interview, Free talk. Each has a short description + estimated minutes. Tap → `/talk?scenario=bakery`.

### 5.5 Recap (`/recap/[sessionId]`)
Veri-style tile grid, cool palette:
- Minutes spoken, words produced, new words, fluency score (0–100, LLM-judged)
- "Notes" list: each `{ you_said, native_would_say, why, grammar_tag }`
- "You handled well" — 1–2 positives
- "Next time, let's try…" — one suggestion
- Button: "Save new words" (adds to vocab memory)

### 5.6 Progress (`/progress`) and Profile (`/profile`)
Progress: streak calendar, weak-spot trend (bar chart of grammar tags over weeks), vocab count line. Profile: level, goals, voice settings, correction intensity (Gentle / Normal / Strict), delete data.

---

## 6. Backend architecture

### 6.1 Data models (SQLAlchemy)

```
users            id, name, level, goals[], comfort, created_at
sessions         id, user_id, scenario, started_at, ended_at, minutes, fluency_score, summary
messages         id, session_id, role (user|tutor), text_de, text_en_hint, audio_url, created_at
corrections      id, session_id, message_id, you_said, native, why, grammar_tag, severity
vocab            id, user_id, word, lemma, gloss_en, first_seen_session, times_used, status (new|learning|owned)
memories         id, user_id, kind (fact|mistake_pattern|preference|goal), text, embedding vector(1536), weight, last_used, created_at
reference_chunks id, source (grammar|scenario|phrasebook), title, text, level, embedding vector(1536), meta jsonb
```

### 6.2 API (FastAPI)

```
POST /onboarding                 → create user + seed memories
GET  /me                         → profile + stats

POST /sessions                   {scenario?} → session_id, opening tutor line (text + audio)
POST /sessions/{id}/turn         {text | audio} → tutor reply (text + audio), running correction count
POST /sessions/{id}/help         {english} → {german, note}
POST /sessions/{id}/end          → recap payload (runs correction + memory extraction)
GET  /sessions/{id}/recap

GET  /scenarios
GET  /progress
POST /vocab/save                 {session_id, words[]}

# v1: speech happens in the browser (Web Speech API); /turn takes text only.
# v2 (optional, still free):
POST /speech/stt                 audio → text via faster-whisper
POST /speech/tts                 text → audio via Piper
```

Use **streaming** for `/turn` (SSE): stream tutor text tokens; the browser speaks them with `speechSynthesis` sentence by sentence.

### 6.3 The conversation loop (`session_service.turn`)

1. v1: text arrives already transcribed by the browser. (v2: STT audio server-side.)
2. Retrieve context (see RAG below).
3. Build prompt: system + retrieved memories + retrieved reference + scenario script + last N turns.
4. Call LLM with **structured output**:
   ```json
   {
     "reply_de": "...",
     "difficulty_signal": -1 | 0 | 1,
     "silent_corrections": [{ "you_said": "", "native": "", "why": "", "grammar_tag": "" }],
     "new_vocab": ["..."]
   }
   ```
5. Persist message + corrections (not shown yet). Adjust `session.difficulty` by `difficulty_signal`.
6. Stream the reply text back; client handles TTS.

The tutor reply is **German only**, pitched slightly above user level (i+1). If the user clearly flounders twice, drop a level and shorten sentences. Never switch to English unless asked.

### 6.4 Session end (`correction_service` + `memory_service`)

- Dedupe and rank corrections by severity and frequency.
- LLM pass over the transcript → fluency score, positives, one next-step suggestion, session summary.
- **Memory extraction**: LLM extracts durable facts ("works in IT", "going to Berlin in November"), recurring mistake patterns ("confuses dative/accusative after 'in'"), and preferences. Upsert into `memories` with embeddings; bump `weight` on repeats, decay unused ones monthly.

---

## 7. RAG design

Two separate vector collections, both in pgvector, queried per turn.

### 7.1 Personal memory (per user)
- **Source**: extracted at session end (6.4) + onboarding seed.
- **Query**: embed the last user utterance + a short rolling summary of the session.
- **Retrieve**: top 6 by cosine similarity × `weight`, plus **always** include the top 3 `mistake_pattern` memories regardless of similarity (so the tutor can quietly set up situations that exercise weak spots).
- **Inject** as: "What you know about this learner:" bullet list.

### 7.2 Reference knowledge (shared)
- **Sources** (`api/data/`, markdown, ingested by `rag/ingest.py`):
  - Grammar reference, chunked by topic (~300 tokens), tagged with CEFR level.
  - Scenario scripts: for each scenario, typical phrases, vocabulary, cultural notes, likely branches.
  - Phrasebook / collocations.
- **Query**: embed user utterance + scenario name + current grammar tags from recent corrections.
- **Retrieve**: top 4, filtered to `level <= user_level + 1`.
- **Inject** as: "Reference (use naturally, never lecture):"

### 7.3 Chunking & ingest
- Markdown headings define chunks; split further at ~300 tokens with 40-token overlap.
- Store `meta`: `{source, level, tags[], scenario?}`.
- `python -m app.rag.ingest ./data` is idempotent (hash-based upsert).

### 7.4 Hybrid search
Add a `tsvector` column and do BM25-ish full-text + vector, merged with reciprocal rank fusion. German has compound words; vector alone misses exact terms.

---

## 8. Prompts (`api/app/llm/prompts.py`)

Keep prompts in Python files as constants, not in the DB. Core system prompt for the tutor, in spirit:

- You are {tutor_name}, a warm, patient German-speaking friend. Speak only German.
- Learner level {level}; speak just above it. Short sentences at A1–A2, natural at B1+.
- Stay in the scenario: {scenario_script}.
- Never correct mid-conversation. Log corrections in the structured field instead.
- If the learner is stuck, offer a gentle lead-in ("Möchtest du vielleicht…?"), don't answer for them.
- Use what you know about the learner naturally; don't recite it.
- Return JSON matching the schema exactly.

Separate prompts for: `help_me_say_this`, `end_of_session_recap`, `memory_extraction`, `placement_test`.

---

## 9. Build order (milestones)

1. **Skeleton**: Docker Compose, Postgres+pgvector, FastAPI health route, Next.js with design tokens, `<Blob/>`, `<GlassCard/>`, `<BottomNav/>`. Home screen with fake data.
2. **Text conversation**: `/sessions`, `/turn` (text only), Talk screen with transcript, structured LLM output, corrections stored silently. Recap screen.
3. **Voice**: Web Speech API in the browser (STT + TTS, `de-DE`), mic pill, Blob pulse synced to `speechSynthesis` events. No server audio yet.
4. **RAG**: ingest grammar + 3 scenarios, retriever, hybrid search, memory extraction at session end.
5. **Onboarding + scenarios + progress** screens.
6. **Polish**: dark mode, PWA manifest, haptics via Vibration API, offline-safe transcript cache.

Finish each milestone end-to-end (API + UI + a test) before starting the next.

---

## 10. Conventions

- TypeScript strict. Python typed, `ruff` + `mypy`.
- Every API route has a Pydantic request/response model.
- Every LLM call goes through `app/llm/client.py` with retries, timeout, token logging, and provider fallback (Gemini → Groq).
- Tests: `pytest` for API (mock the LLM), Playwright mobile viewport (390×844) for critical flows.
- Secrets in `.env`, never committed. Provide `.env.example`.
- Commit messages: `feat(talk): …`, `fix(rag): …`.
- Don't add a component library, don't add Redux, don't add a second DB.

---

## 11. Open questions (decide as you go, note decisions here)

- Is the browser's German voice tolerable? If not, add Piper (free, local) in milestone 6.
- Does Web Speech STT handle German well enough on your phone? If not, add faster-whisper.
- Gemini free-tier rate limits: add simple client-side throttling + Groq fallback in `app/llm/client.py`.
- Should "Help me say this" results count as the user's own words in fluency scoring? (Default: no.)

### Decisions so far

- **2026-10-15, milestone 1.** Tab screens (Home, Scenarios, Progress, Profile) live in the `app/(tabs)/` route group so only they render the bottom nav; `/talk` and `/onboarding` sit outside it. Public URLs are unchanged.
- Scenario cards use two layered gradient glows instead of blurred photos until there are image assets.
- `glass` / `glass-strong` utilities set background, blur and border only. Radius comes from `rounded-card` or `rounded-pill`, so pills and circles compose without overrides.
- The Blob is the glossy sphere from inspo image 3, not a flat circle: layered radial gradients, inset highlight, SVG face with morphing mouth, blink loop, pulse on `speaking`.
- Python is managed with `uv` (`api/pyproject.toml` + `uv.lock`). The API Docker image keeps its venv at `/opt/venv` so the dev bind mount does not shadow it.
- `GET /health` always returns 200 and reports `db: true|false`, so the API boots without Postgres and the web app can show a status.
- Tests: `api/tests` with a mocked DB ping; `web/tests` Playwright at 390×844 covering Home, nav, scenario deep-link and a no-console-errors sweep of every screen.
- **2026-10-15, design pass after first review.** Light is the default theme; `prefers-color-scheme` is no longer used for tokens. `<html data-theme="light|dark">` is set by an inline script in `web/lib/theme-script.ts` before paint, and the Profile screen has a Light / Dark / Auto segmented pill (`ThemeToggle`, stored in localStorage as `yapster-theme`). Dark stays supported but secondary: every reference image except Veri is light, and dark loses the glass-over-glow look.
- Added `--glow-amber` (#FFD08A) to the palette for the warm glow behind the hero card in reference image 5.
- `<Backdrop variant="warm|cool" />` paints soft ambient glows fixed to the viewport (z -10, background lives on `<html>` only). Keep it faint: a light warm-grey page with tinted corners; focused glows go in the screen itself. Horizontal overflow is clipped on `html`/`body`, not on `main`, so glows can bleed past the column on desktop.
- Scenario cards are vivid three-colour gradients with a glass chip, standing in for the blurred photo tiles in reference image 2.
- **2026-10-16, LLM providers verified with real keys** (all free, JSON mode works on every model listed):
  - Gemini: `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.8-flash` all answer; `gemini-2.5-flash` is gone for new users. No rate-limit headers; quota only visible in AI Studio or via 429s, and third-party reports put the newest non-lite Flash at a few dozen requests/day on free.
  - Groq: `qwen/qwen3.8-27b` (fast, no reasoning tokens), `openai/gpt-oss-20b`, `openai/gpt-oss-120b` (needs `reasoning_effort: low` and ≥400 output tokens or JSON truncates). Limits: 1,000 requests/day, 8,000 tokens/minute per model. Also exposes `whisper-large-v3-turbo`, a free STT fallback for milestone 3.
  - Mistral (Experiment plan): `ministral-14b-latest` 30 req/min, 937K tokens/min; `ministral-8b-latest` 188 req/min, 625K tokens/min. `mistral-small`, `mistral-medium` and `magistral` return 429 with a 0 req/min limit on this plan.
  - Chosen chains (env-configurable, first that succeeds wins): live tutor `gemini:gemini-3.5-flash-lite → groq:qwen/qwen3.8-27b → mistral:ministral-14b-latest`; batch recap/memory `gemini:gemini-3.8-flash → mistral:ministral-14b-latest → groq:openai/gpt-oss-120b`. Keep live prompts under ~1.5K tokens so Groq's 8K TPM allows 4–5 turns a minute. Flip the order in `.env` once real quotas show up in the token log.
- **2026-10-16, milestone 2 (text conversation) shipped.**
  - Providers are called over plain REST with httpx (`app/llm/providers.py`) rather than three SDKs: one code path, one retry/timeout policy, trivially mockable. Chains come from `LLM_CHAT_CHAIN` / `LLM_BATCH_CHAIN`.
  - `/turn` streams SSE (`start`, `delta`*, `done` | `error`). The tutor still returns one JSON object; `ReplyExtractor` pulls `reply_de` out of the byte stream as it arrives, so one call gives both streaming text and the structured corrections. If a provider fails before the first delta the client falls through to the next one; after a delta it reports `error`.
  - Gemini 3.x Flash (non-lite) spends 600–800 "thinking" tokens that count against `maxOutputTokens`; `GEMINI_THINKING_HEADROOM` adds 2048 on top of every requested budget. Flash-Lite does not think and answers in ~1.3 s.
  - Difficulty is a CEFR index on the session, nudged by `difficulty_signal` each turn and by the user, clamped to the learner's level ±1.
  - Lines produced via Help-me-say-this are stored with `assisted=true`: no corrections are logged for them and they do not count towards words/fluency (open question from §11 resolved: default no).
  - Every provider attempt is a row in `llm_calls` (tokens, latency, error), so quota behaviour is observable.
  - Embedding columns are `vector(384)` for `intfloat/multilingual-e5-small`, not 1536; `EMBEDDING_DIM` is config.
  - v1 auth: every route except `/health` needs `Authorization: Bearer $API_TOKEN`. `next.config.ts` reads the root `.env` and inlines the token into the bundle; the client derives the API base from the page host so the phone works without config. CORS accepts any private-network origin in dev.
  - Streaming routes open their own DB session (`get_session_factory()`) because the request-scoped one can close before the stream ends.
  - Tests: API 19 (unit + full flow against a `yapster_test` database that is created on demand); web 16 Playwright flows with the API mocked via `page.route`.
  - Known: `uvicorn --reload` stalls on this Windows setup after the first reload; run the API without `--reload` and restart it by hand after API changes.
- **2026-10-16, accounts, landing, onboarding.** Scope expanded past the v1 single-user token at the user's request.
  - Auth is self-hosted (`app/services/auth_service.py`): email + password with argon2id, opaque 32-byte tokens stored as SHA-256 in `auth_tokens`, 30-day expiry, one row per login, logout revokes only the presented token. Every route except `/health` and `/auth/*` resolves the bearer token to a user; the shared `API_TOKEN` is gone. No rate limiting or email verification yet.
  - `users.onboarded` gates the app. `POST /onboarding` flips it and seeds memories; new accounts start at A2 until onboarding.
  - Web session = two cookies set by the client (`yapster_token`, `yapster_onboarded`), read by `middleware.ts` to route: signed-out → `/welcome`, signed-in but new → `/onboarding`, otherwise the app. The matcher is the plain `/:path*`; a lookahead pattern silently matched only `/` under Next 15.5, so internals and files are skipped in code.
  - Screens: `/welcome` (landing, references 3+4), `/register` and `/login` (one `AuthScreen`), `/onboarding` (five questions, Blob reacts per answer, "Not sure" maps to A2 for now; the placement chat is still milestone 5). Home and Profile read the real profile via `useMe()`; Profile has Log out. The first talk after onboarding opens the scenario matching the first goal.
  - Tests: API 22; web 23 Playwright flows with API mocks scoped to `http://localhost:8000` (a `**/onboarding` glob also matched the page URL). `expect` timeout is 15 s because the dev server compiles pages on first visit.
- **2026-10-16, Google sign-in and a real dashboard.**
  - Google OAuth 2.0 (authorization code + PKCE) lives entirely in the API (`services/oauth_service.py`, `/auth/google/start` → Google → `/auth/google/callback`). State and the PKCE verifier ride in a 10-minute HttpOnly cookie scoped to `/auth/google`. The callback finds the account by Google id, else links a same-email account (only if Google verified the email), else creates one, then mints our own bearer token and redirects to `{web}/auth/callback#token=…&onboarded=…` (fragment, so the token never hits a server log). The web page stores the cookies and routes on.
  - Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `PUBLIC_API_URL` / `PUBLIC_WEB_URL` (default localhost:8000 / localhost:3000). Google Cloud Console must list `{PUBLIC_API_URL}/auth/google/callback` as an authorized redirect URI. Google rejects LAN IPs and plain-http hostnames, so Google sign-in only completes from the laptop until HTTPS/tunnel in milestone 3; the button hides itself on other origins (`GET /auth/providers` reports `web_origin`).
  - `GET /dashboard` replaces the fake Home data: day number, streak (consecutive days with a finished session, counting from today or yesterday), minutes in the past 7 days vs a 60-minute goal, last session with its note count, next-session suggestion (first unplayed scenario matching the first goal, else least played), words owned, and the most frequent grammar tag of the last 30 days with its latest native example. `lib/fake.ts` became `lib/scenarios.ts` (just the card palette).
  - Tests: API 29 (Google mocked with an httpx MockTransport injected via the `get_http` dependency); web 26 Playwright flows, where the Google start URL is mocked as a 302 straight to the hand-off page.
- **2026-10-16, leaving a conversation.** Talk has a Back button (top-left). With nothing said it calls `DELETE /sessions/{id}` (allowed only while unfinished; finished sessions are history) and returns to the dashboard. After the learner has spoken it opens a sheet: see the recap, discard, or keep talking. Onboarding still lands on the first talk per the brief; the dashboard is one tap away.
- **2026-10-16, animated background.** Backdrop glows (and the hero glow on Home, the big blobs on Welcome) drift and breathe on three staggered 26–42 s transform-only keyframe paths (`.drift-1/2/3` in `globals.css`, applied via `<Glow drift={n} />`). Plain CSS classes with literal names, because Tailwind drops `@utility` definitions whose names are built dynamically. Off under `prefers-reduced-motion`. Glows that drift must be positioned with offsets or margins, never translate classes, since the animation owns `transform`.
- **2026-10-16, milestone 3 (voice) shipped.** Speech stays in the browser, no server audio.
  - `web/lib/speech/`: `config.ts` (one `SPEECH_LANG = "de-DE"` and voice-name preferences, the hook for a second language later), `sentences.ts` (`SentenceSplitter` emits a sentence only when its end punctuation is followed by whitespace, so "4,80 Euro" and "z.B." survive), `speaker.ts` (speechSynthesis queue behind a zustand store: `speaking`, `enabled`, `needsTap`, `available`), `useSpeechInput.ts` (tap-to-toggle `SpeechRecognition`, one utterance per tap, final transcript is sent as the learner's line).
  - The talk store feeds every streamed delta through the splitter and speaks sentences as they complete; the `done` event flushes the remainder. Starting a turn or the mic cancels any speech in progress. The Blob pulses on `speaking || streaming`; a rose ring shows while listening.
  - Browsers refuse `speak()` without user activation (a hard reload of /talk). Sentences are then held and a "Tap to hear Lena" pill appears; any tap plays them.
  - Voice on/off lives in the Talk header and persists in localStorage (`yapster-voice`). Without SpeechRecognition (desktop Firefox) the mic hides and typing remains.
  - HTTPS for the phone's microphone: `npm run certs` makes a local CA plus a server cert for localhost and the LAN IPs (`certs/`, gitignored; CA copied to `web/public/yapster-dev-ca.pem` for the phone to install). `npm run dev:https` serves on **3443**, the API with `--ssl-keyfile/--ssl-certfile` on **8443**; `apiUrl()` maps https → 8443. Plain http on 3000/8000 stays the default for the laptop and for Playwright. Google sign-in still only completes on the laptop (Google refuses LAN IPs regardless of TLS).
  - Tests: web 32 Playwright flows; the voice spec installs fake Web Speech APIs via `addInitScript` (recognition finishes only when the test says so; synthesis records sentences and ends on demand so the Blob state is observable).
