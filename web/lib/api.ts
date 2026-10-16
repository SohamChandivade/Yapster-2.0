/**
 * Typed client for the Yapster API, including the server-sent-events turn stream.
 *
 * The base URL is derived from the page's own hostname so the same build works on
 * localhost and on a phone reaching the laptop over the hotspot. Set
 * NEXT_PUBLIC_API_URL to override. The bearer token comes from the session cookie.
 */

import { getToken } from "./auth";

export function apiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    // Plain dev runs on 3000/8000; the HTTPS pair for the phone's microphone on 3443/8443.
    const { protocol, hostname } = window.location;
    const port = protocol === "https:" ? 8443 : 8000;
    return `${protocol}//${hostname}:${port}`;
  }
  return "http://localhost:8000";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { ...baseHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ── Types mirroring api/app/schemas ─────────────────────────────── */

export type Health = { status: "ok"; version: string; db: boolean };

export type User = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  onboarded: boolean;
  level: string;
  comfort: string;
  goals: string[];
  tutor_name: string;
  correction_intensity: string;
  created_at: string;
};

export type Me = {
  user: User;
  stats: { sessions: number; minutes: number; words_owned: number; corrections: number };
};

export type AuthResponse = { token: string; user: User };

export type OnboardingInput = {
  name: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  comfort: "terrifying" | "awkward" | "fine" | "pretty_good";
  goals: string[];
  tutor_name?: string;
};

export type StartSession = {
  session_id: string;
  scenario: string;
  scenario_title: string;
  tutor_name: string;
  opening: string;
  level: string;
  difficulty: number;
};

export type TurnDone = {
  message_id: string;
  reply_de: string;
  correction_count: number;
  new_corrections: number;
  difficulty: number;
  level: string;
  new_vocab: string[];
  provider: string;
  model: string;
};

export type TurnEvent =
  | { event: "start"; data: { message_id: string } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: TurnDone }
  | { event: "error"; data: { message: string } };

export type Correction = {
  id: string;
  you_said: string;
  native: string;
  why: string;
  grammar_tag: string;
  severity: number;
};

export type Help = { german: string; note: string };

export type Note = {
  you_said: string;
  native_would_say: string;
  why: string;
  grammar_tag: string;
  times: number;
};

export type Recap = {
  session_id: string;
  scenario: string;
  scenario_title: string;
  tutor_name: string;
  minutes: number;
  words_produced: number;
  fluency_score: number | null;
  summary: string | null;
  notes: Note[];
  positives: string[];
  next_step: string | null;
  new_words: { word: string; gloss_en: string }[];
};

export type Scenario = { slug: string; title: string; blurb: string; minutes: number };

export type Providers = { google: { enabled: boolean; web_origin: string } };

export type Dashboard = {
  user: User;
  day: number;
  streak_days: number;
  minutes_last_7_days: number;
  weekly_goal_minutes: number;
  sessions_total: number;
  words_owned: number;
  words_last_7_days: number;
  last_session: {
    session_id: string;
    scenario: string;
    scenario_title: string;
    minutes: number;
    notes: number;
    fluency_score: number | null;
    ended_at: string;
  } | null;
  next_session: { scenario: string; scenario_title: string; minutes: number; reason: string };
  weak_spot: { grammar_tag: string; count: number; example_native: string | null } | null;
};

/* ── Calls ───────────────────────────────────────────────────────── */

export const api = {
  health: () => request<Health>("/health"),

  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  providers: () => request<Providers>("/auth/providers"),
  /** Full-page navigation target that starts Google sign-in and returns to this origin. */
  googleStartUrl: () =>
    `${apiUrl()}/auth/google/start?return_to=${encodeURIComponent(window.location.origin)}`,
  dashboard: () => request<Dashboard>("/dashboard"),
  me: () => request<Me>("/me"),
  onboarding: (input: OnboardingInput) =>
    request<User>("/onboarding", { method: "POST", body: JSON.stringify(input) }),

  scenarios: () => request<Scenario[]>("/scenarios"),
  startSession: (scenario?: string | null) =>
    request<StartSession>("/sessions", {
      method: "POST",
      body: JSON.stringify({ scenario: scenario ?? null }),
    }),
  help: (sessionId: string, english: string) =>
    request<Help>(`/sessions/${sessionId}/help`, {
      method: "POST",
      body: JSON.stringify({ english }),
    }),
  nudge: (sessionId: string, delta: -1 | 1) =>
    request<{ difficulty: number; level: string }>(`/sessions/${sessionId}/difficulty`, {
      method: "POST",
      body: JSON.stringify({ delta }),
    }),
  corrections: (sessionId: string) => request<Correction[]>(`/sessions/${sessionId}/corrections`),
  end: (sessionId: string) => request<Recap>(`/sessions/${sessionId}/end`, { method: "POST" }),
  discard: (sessionId: string) => request<void>(`/sessions/${sessionId}`, { method: "DELETE" }),
  recap: (sessionId: string) => request<Recap>(`/sessions/${sessionId}/recap`),
  saveVocab: (sessionId: string, words: string[]) =>
    request<{ saved: number; total: number }>("/vocab/save", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, words }),
    }),

  /** POST a turn and yield SSE events as they arrive. */
  async *turn(
    sessionId: string,
    text: string,
    assisted = false,
    signal?: AbortSignal,
  ): AsyncGenerator<TurnEvent> {
    const res = await fetch(`${apiUrl()}/sessions/${sessionId}/turn`, {
      method: "POST",
      headers: { ...baseHeaders(), Accept: "text/event-stream" },
      body: JSON.stringify({ text, assisted }),
      signal,
    });
    if (!res.ok || !res.body) throw new ApiError(res.status, res.statusText || "Turn failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf("\n\n");
      while (idx >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const parsed = parseFrame(frame);
        if (parsed) yield parsed;
        idx = buffer.indexOf("\n\n");
      }
    }
  },
};

function parseFrame(frame: string): TurnEvent | null {
  let event = "";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!event || !data) return null;
  return { event, data: JSON.parse(data) } as TurnEvent;
}
