import type { Page } from "@playwright/test";

export const SID = "11111111-1111-1111-1111-111111111111";
export const ORIGIN = "http://localhost:3000";
/** The API origin the client derives from the page host; mocks match it exactly so page URLs are never intercepted. */
export const API = "http://localhost:8000";

export const USER = {
  id: "u1",
  name: "Ujjwal",
  email: "ujjwal@example.com",
  avatar_url: null,
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
export async function mockApi(page: Page, opts: { session?: SessionKind } = {}): Promise<void> {
  const session = opts.session ?? "onboarded";
  if (session !== "none") await signIn(page, session === "onboarded");

  await page.route(`${API}/me`, (route) =>
    route.fulfill(
      json(200, {
        user: USER,
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
      : route.fulfill(json(404, { detail: "Session not found" })),
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
