import type { Page } from "@playwright/test";

export const SID = "11111111-1111-1111-1111-111111111111";
export const ORIGIN = "http://localhost:3000";
/** The API origin the client derives from the page host; mocks match it exactly so page URLs are never intercepted. */
export const API = "http://localhost:8000";

export const USER = {
  id: "u1",
  name: "Ujjwal",
  email: "ujjwal@example.com",
  avatar_url: null as string | null,
  onboarded: true,
  level: "B1",
  comfort: "awkward",
  goals: ["work"],
  tutor_name: "Lena",
  correction_intensity: "normal",
  created_at: "2026-10-16T00:00:00Z",
};

export const recap = {
  session_id: SID,
  scenario: "bakery",
  scenario_title: "Bakery",
  tutor_name: "Lena",
  minutes: 4.2,
  words_produced: 31,
  fluency_score: 62,
  summary: "Du hast zwei Brötchen und ein Brot gekauft.",
  notes: [
    {
      you_said: "Ich möchte ein Brot",
      native_would_say: "Ich hätte gern ein Brot",
      why: "'Hätte gern' is the usual polite form when ordering.",
      grammar_tag: "register",
      times: 1,
    },
  ],
  positives: ["You asked for a bag without help."],
  next_step: "Try asking one follow-up question yourself.",
  new_words: [{ word: "die Tüte", gloss_en: "bag" }],
};

export const dashboard = {
  user: USER,
  day: 12,
  streak_days: 3,
  minutes_last_7_days: 42,
  weekly_goal_minutes: 60,
  sessions_total: 5,
  words_owned: 184,
  words_last_7_days: 9,
  last_session: {
    session_id: SID,
    scenario: "bakery",
    scenario_title: "Bakery",
    minutes: 8,
    notes: 3,
    fluency_score: 62,
    ended_at: "2026-10-16T08:00:00Z",
  },
  next_session: {
    scenario: "interview",
    scenario_title: "Job interview",
    minutes: 10,
    reason: "Matches your goal: Work",
  },
  weak_spot: { grammar_tag: "dative", count: 4, example_native: "mit dem Bus" },
  open_session: null,
};

export const SID2 = "22222222-2222-2222-2222-222222222222";

const isoDay = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};
const mondayAgo = (weeksAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeksAgo * 7);
  return d.toISOString().slice(0, 10);
};

/** 35 days ending today with three active days, four weeks of tags, eight weeks of vocab. */
export function progressFixture() {
  const active: Record<number, [number, number]> = { 0: [8, 1], 1: [12.5, 2], 5: [4, 1] };
  const owned = [20, 41, 60, 88, 110, 131, 160, 184];
  return {
    days: Array.from({ length: 35 }, (_, i) => {
      const ago = 34 - i;
      const [minutes, sessions] = active[ago] ?? [0, 0];
      return { date: isoDay(ago), minutes, sessions };
    }),
    streak_days: 2,
    best_streak: 4,
    weeks: [3, 2, 1, 0].map(mondayAgo),
    weak_spots: [
      { grammar_tag: "dative", total: 7, weekly: [1, 2, 1, 3] },
      { grammar_tag: "word_order", total: 4, weekly: [0, 2, 1, 1] },
    ],
    vocab: [7, 6, 5, 4, 3, 2, 1, 0].map((w, i) => ({ week_start: mondayAgo(w), owned: owned[i] })),
    sessions: [
      {
        session_id: SID,
        scenario: "bakery",
        scenario_title: "Bakery",
        ended_at: new Date().toISOString(),
        minutes: 8,
        notes: 3,
        fluency_score: 62,
      },
      {
        session_id: SID2,
        scenario: "party",
        scenario_title: "Party small talk",
        ended_at: new Date(Date.now() - 86400000).toISOString(),
        minutes: 12.5,
        notes: 1,
        fluency_score: 71,
      },
    ],
    totals: { sessions: 5, minutes: 48.5, words: 184, corrections: 11 },
  };
}

const now = new Date().toISOString();
export const scenarioList = [
  { slug: "bakery", title: "Bakery", blurb: "Order bread, ask for a bag, pay.", minutes: 5, played: 3, last_played_at: now },
  { slug: "train", title: "Train ticket", blurb: "Buy a ticket, ask about the delay.", minutes: 6, played: 0, last_played_at: null },
  { slug: "doctor", title: "Doctor", blurb: "Describe what hurts, book a follow-up.", minutes: 8, played: 0, last_played_at: null },
  { slug: "landlord", title: "Landlord", blurb: "The heating is broken. Again.", minutes: 8, played: 1, last_played_at: now },
  { slug: "party", title: "Party small talk", blurb: "Who are you, how do you know the host?", minutes: 7, played: 1, last_played_at: now },
  { slug: "interview", title: "Job interview", blurb: "Introduce yourself, talk about strengths.", minutes: 10, played: 0, last_played_at: null },
  { slug: "free", title: "Free talk", blurb: "No script. Just talk.", minutes: 10, played: 0, last_played_at: null },
];

export const sessionState = {
  session_id: SID,
  scenario: "bakery",
  scenario_title: "Bakery",
  tutor_name: "Lena",
  level: "B1",
  difficulty: 2,
  started_at: new Date(Date.now() - 600000).toISOString(),
  ended: false,
  correction_count: 1,
  transcript: [
    { id: "t1", role: "tutor", text: "Guten Morgen! Was darf es sein?", text_en: "Good morning! What can I get you?", assisted: false },
    { id: "u1", role: "user", text: "Ich möchte ein Brot", text_en: null, assisted: false },
    { id: "t2", role: "tutor", text: "Gern, ein Roggenbrot. Soll ich es schneiden?", text_en: "Sure, a rye bread. Shall I slice it?", assisted: false },
  ],
};

export type SessionKind = "none" | "new" | "onboarded";

/** Set the two session cookies the middleware reads. */
export async function signIn(page: Page, onboarded = true): Promise<void> {
  await page.context().addCookies([
    { name: "yapster_token", value: "test-token", url: ORIGIN },
    { name: "yapster_onboarded", value: onboarded ? "1" : "0", url: ORIGIN },
  ]);
}

function sse(events: Array<[string, unknown]>): string {
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
}

const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Route every API call the screens make to canned responses, and sign in unless told not to. */

export async function mockApi(
  page: Page,
  opts: { session?: SessionKind; user?: Partial<typeof USER> } = {},
): Promise<void> {
  const session = opts.session ?? "onboarded";
  if (session !== "none") await signIn(page, session === "onboarded");

  await page.route(`${API}/me`, (route) =>
    route.fulfill(
      json(200, {
        user: {...USER, ...opts.user},
        stats: { sessions: 3, minutes: 24.5, words_owned: 12, corrections: 7 },
      }),
    ),
  );
  await page.route(`${API}/auth/register`, (route) =>
    route.fulfill(json(201, { token: "new-token", user: { ...USER, name: "fresh", onboarded: false } })),
  );
  await page.route(`${API}/auth/login`, (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password === "wrong password") {
      return route.fulfill(json(401, { detail: "Email or password is incorrect." }));
    }
    return route.fulfill(json(200, { token: "login-token", user: USER }));
  });
  await page.route(`${API}/auth/logout`, (route) => route.fulfill({ status: 204, body: "" }));
  await page.route(`${API}/auth/providers`, (route) =>
    route.fulfill(json(200, { google: { enabled: true, web_origin: ORIGIN } })),
  );
  // The real endpoint bounces through Google; here it lands straight on the hand-off page.
  await page.route(`${API}/auth/google/start*`, (route) =>
    route.fulfill({
      status: 302,
      headers: { location: `${ORIGIN}/auth/callback#token=google-token&onboarded=1` },
      body: "",
    }),
  );
  await page.route(`${API}/dashboard`, (route) => route.fulfill(json(200, dashboard)));
  await page.route(`${API}/progress`, (route) => route.fulfill(json(200, progressFixture())));
  await page.route(`${API}/scenarios`, (route) => route.fulfill(json(200, scenarioList)));
  await page.route(`${API}/onboarding`, (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill(json(200, { ...USER, ...body, onboarded: true }));
  });

  await page.route(`${API}/sessions`, (route) =>
    route.fulfill(
      json(201, {
        session_id: SID,
        scenario: "bakery",
        scenario_title: "Bakery",
        tutor_name: "Lena",
        opening: "Guten Morgen! Was darf es sein?",
        opening_en: "Good morning! What can I get you?",
        opening_message_id: "m0",
        level: "B1",
        difficulty: 2,
      }),
    ),
  );

  await page.route(`${API}/sessions/${SID}/turn`, async (route) => {
    const body = route.request().postDataJSON() as { text: string; assisted?: boolean };
    const reply = body.assisted
      ? "Natürlich, hier ist eine Tüte."
      : "Gern, ein Roggenbrot. Soll ich es schneiden?";
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sse([
        ["start", { message_id: "m1" }],
        ["delta", { text: reply.slice(0, 10) }],
        ["delta", { text: reply.slice(10) }],
        [
          "done",
          {
            message_id: "m2",
            reply_de: reply,
            reply_en: body.assisted ? "Of course, here is a bag." : "Sure, a rye bread. Shall I slice it?",
            correction_count: 1,
            new_corrections: body.assisted ? 0 : 1,
            difficulty: 2,
            level: "B1",
            new_vocab: ["das Roggenbrot"],
            provider: "mock",
            model: "mock",
          },
        ],
      ]),
    });
  });

  await page.route(`${API}/sessions/${SID}`, (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({ status: 204, body: "" })
      : route.fulfill(json(200, sessionState)),
  );
  await page.route(`${API}/sessions/${SID}/hint`, (route) =>
    route.fulfill(
      json(200, {
        message_id: "m0",
        tutor_line: "Guten Morgen! Was darf es sein?",
        translation: "Good morning! What can I get you?",
        suggestions: [
          { german: "Ein Brot, bitte.", english: "A bread, please." },
          { german: "Was ist frisch?", english: "What is fresh?" },
          { german: "Zwei Brötchen, bitte.", english: "Two rolls, please." },
        ],
        tip: "She is asking what you would like; name one thing and add bitte.",
      }),
    ),
  );
  await page.route(`${API}/sessions/${SID}/help`, (route) =>
    route.fulfill(
      json(200, { german: "Könnte ich bitte eine Tüte haben?", note: "Polite conditional." }),
    ),
  );
  await page.route(`${API}/sessions/${SID}/corrections`, (route) =>
    route.fulfill(
      json(200, [
        {
          id: "c1",
          you_said: "Ich möchte ein Brot",
          native: "Ich hätte gern ein Brot",
          why: "'Hätte gern' is the usual polite form when ordering.",
          grammar_tag: "register",
          severity: 1,
        },
      ]),
    ),
  );
  await page.route(`${API}/sessions/${SID}/difficulty`, (route) =>
    route.fulfill(json(200, { difficulty: 1, level: "A2" })),
  );
  await page.route(`${API}/sessions/${SID}/end`, (route) => route.fulfill(json(200, recap)));
  await page.route(`${API}/sessions/${SID}/recap`, (route) => route.fulfill(json(200, recap)));
  await page.route(`${API}/vocab/save`, (route) => route.fulfill(json(200, { saved: 1, total: 1 })));
}
