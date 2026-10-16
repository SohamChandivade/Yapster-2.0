import { create } from "zustand";
import { api, ApiError, type Correction, type Hint } from "./api";
import { SentenceSplitter, splitSentences } from "./speech/sentences";
import { speaker } from "./speech/speaker";

export type Line = {
  id: string;
  role: "tutor" | "user";
  text: string;
  /** English meaning of a tutor line, shown on request or in "show English" mode. */
  en?: string;
  /** Server id of a tutor line, so a hint can target it even after newer lines arrive. */
  messageId?: string;
  assisted?: boolean;
};

export type TalkStatus =
  | "idle"
  | "starting"
  | "ready"
  | "thinking"
  | "speaking"
  | "ending"
  | "ended"
  | "failed";

const SHOW_ENGLISH_KEY = "yapster-show-english";

type State = {
  sessionId: string | null;
  scenario: string | null;
  scenarioTitle: string;
  tutorName: string;
  level: string;
  status: TalkStatus;
  lines: Line[];
  correctionCount: number;
  corrections: Correction[];
  error: string | null;
  /** Hints keyed by the tutor line they explain. */
  hints: Record<string, Hint>;
  hintLoading: string | null;
  hintError: string | null;
  showEnglish: boolean;
};

type Actions = {
  start: (scenario?: string | null) => Promise<void>;
  /** Pick up an unfinished conversation where it was left. */
  resume: (sessionId: string) => Promise<void>;
  send: (text: string, assisted?: boolean) => Promise<void>;
  nudge: (delta: -1 | 1) => Promise<void>;
  loadCorrections: () => Promise<void>;
  /** Fetch (once) the hint for the latest tutor line. */
  loadHint: (lineId: string) => Promise<void>;
  loadPrefs: () => void;
  setShowEnglish: (value: boolean) => void;
  end: () => Promise<string | null>;
  /** Leave without a recap. The unfinished session is deleted server-side. */
  discard: () => Promise<void>;
  dismissError: () => void;
  reset: () => void;
};

const initial: State = {
  sessionId: null,
  scenario: null,
  scenarioTitle: "",
  tutorName: "",
  level: "",
  status: "idle",
  lines: [],
  correctionCount: 0,
  corrections: [],
  error: null,
  hints: {},
  hintLoading: null,
  hintError: null,
  showEnglish: false,
};

let counter = 0;
const nextId = () => `local-${++counter}`;

function describe(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export const useTalkStore = create<State & Actions>((set, get) => ({
  ...initial,

  async start(scenario) {
    if (get().status !== "idle") return; // React strict mode mounts twice
    set({ status: "starting", scenario: scenario ?? null, error: null });
    try {
      const s = await api.startSession(scenario);
      set({
        sessionId: s.session_id,
        scenario: s.scenario,
        scenarioTitle: s.scenario_title,
        tutorName: s.tutor_name,
        level: s.level,
        status: "ready",
        lines: [
          {
            id: nextId(),
            role: "tutor",
            text: s.opening,
            en: s.opening_en || undefined,
            messageId: s.opening_message_id,
          },
        ],
      });
      splitSentences(s.opening).forEach((sentence) => speaker.say(sentence));
    } catch (err) {
      set({ status: "failed", error: describe(err) });
    }
  },

  async resume(sessionId) {
    if (get().status !== "idle") return;
    set({ status: "starting", error: null });
    try {
      const s = await api.session(sessionId);
      if (s.ended) {
        set({ status: "failed", error: "That conversation is already finished." });
        return;
      }
      set({
        sessionId: s.session_id,
        scenario: s.scenario,
        scenarioTitle: s.scenario_title,
        tutorName: s.tutor_name,
        level: s.level,
        correctionCount: s.correction_count,
        status: "ready",
        lines: s.transcript.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          en: m.text_en ?? undefined,
          messageId: m.role === "tutor" ? m.id : undefined,
          assisted: m.assisted,
        })),
      });
    } catch (err) {
      set({ status: "failed", error: describe(err) });
    }
  },

  async send(text, assisted = false) {
    const { sessionId, status, lines } = get();
    const clean = text.trim();
    if (!sessionId || status !== "ready" || !clean) return;

    speaker.cancel();
    const pendingId = nextId();
    const splitter = new SentenceSplitter();
    let streamed = false;
    set({
      status: "thinking",
      error: null,
      lines: [...lines, { id: nextId(), role: "user", text: clean, assisted }],
    });

    try {
      for await (const ev of api.turn(sessionId, clean, assisted)) {
        if (ev.event === "delta") {
          streamed = true;
          splitter.push(ev.data.text).forEach((sentence) => speaker.say(sentence));
          set((s) => {
            const has = s.lines.some((l) => l.id === pendingId);
            const next = has
              ? s.lines.map((l) => (l.id === pendingId ? { ...l, text: l.text + ev.data.text } : l))
              : [...s.lines, { id: pendingId, role: "tutor" as const, text: ev.data.text }];
            return { status: "speaking", lines: next };
          });
        } else if (ev.event === "done") {
          const rest = splitter.flush();
          if (rest) speaker.say(rest);
          if (!streamed) splitSentences(ev.data.reply_de).forEach((s) => speaker.say(s));
          const finished: Line = {
            id: pendingId,
            role: "tutor",
            text: ev.data.reply_de,
            en: ev.data.reply_en || undefined,
            messageId: ev.data.message_id,
          };
          set((s) => ({
            status: "ready",
            level: ev.data.level,
            correctionCount: ev.data.correction_count,
            lines: s.lines.some((l) => l.id === pendingId)
              ? s.lines.map((l) => (l.id === pendingId ? finished : l))
              : [...s.lines, finished],
          }));
        } else if (ev.event === "error") {
          speaker.cancel();
          set((s) => ({
            status: "ready",
            error: ev.data.message,
            lines: s.lines.filter((l) => l.id !== pendingId),
          }));
        }
      }
      if (get().status !== "ready") set({ status: "ready" });
    } catch (err) {
      speaker.cancel();
      set((s) => ({
        status: "ready",
        error: describe(err),
        lines: s.lines.filter((l) => l.id !== pendingId),
      }));
    }
  },

  async nudge(delta) {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const r = await api.nudge(sessionId, delta);
      set({ level: r.level });
    } catch (err) {
      set({ error: describe(err) });
    }
  },

  async loadCorrections() {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      set({ corrections: await api.corrections(sessionId) });
    } catch (err) {
      set({ error: describe(err) });
    }
  },

  async loadHint(lineId) {
    const { sessionId, hints, hintLoading, lines } = get();
    if (!sessionId || hints[lineId] || hintLoading) return;
    const line = lines.find((l) => l.id === lineId);
    set({ hintLoading: lineId, hintError: null });
    try {
      const hint = await api.hint(sessionId, line?.messageId);
      set((s) => ({ hints: { ...s.hints, [lineId]: hint }, hintLoading: null }));
    } catch (err) {
      set({ hintLoading: null, hintError: describe(err) });
    }
  },

  loadPrefs() {
    try {
      set({ showEnglish: localStorage.getItem(SHOW_ENGLISH_KEY) === "on" });
    } catch {
      /* private mode */
    }
  },

  setShowEnglish(value) {
    try {
      localStorage.setItem(SHOW_ENGLISH_KEY, value ? "on" : "off");
    } catch {
      /* private mode */
    }
    set({ showEnglish: value });
  },

  async end() {
    const { sessionId, status } = get();
    if (!sessionId || status === "ending" || status === "ended") return sessionId;
    speaker.cancel();
    set({ status: "ending", error: null });
    try {
      await api.end(sessionId);
      set({ status: "ended" });
      return sessionId;
    } catch (err) {
      set({ status: "ready", error: describe(err) });
      return null;
    }
  },

  async discard() {
    const { sessionId, status, showEnglish } = get();
    speaker.cancel();
    if (sessionId && status !== "ended") {
      try {
        await api.discard(sessionId);
      } catch {
        /* already gone or finished; nothing to keep the user for */
      }
    }
    set({ ...initial, showEnglish });
  },

  dismissError: () => set({ error: null }),

  reset: () => {
    speaker.cancel();
    set((s) => ({ ...initial, showEnglish: s.showEnglish }));
  },
}));
