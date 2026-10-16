/**
 * Text-to-speech through the browser's speechSynthesis, one sentence at a time.
 * Exposes a small zustand store so the Blob can pulse while Lena talks.
 *
 * Browsers refuse to speak before the user has interacted with the page; when
 * that happens the sentences wait and `needsTap` asks the screen for one tap.
 */

import { create } from "zustand";
import { SPEECH_LANG, VOICE_ENABLED_KEY, VOICE_PREFERENCES } from "./config";

type SpeakerState = {
  available: boolean;
  enabled: boolean;
  speaking: boolean;
  needsTap: boolean;
  voiceName: string | null;
};

export const useSpeakerStore = create<SpeakerState>(() => ({
  available: false,
  enabled: true,
  speaking: false,
  needsTap: false,
  voiceName: null,
}));

let initialised = false;
let voice: SpeechSynthesisVoice | null = null;
let inFlight = 0;
let pending: string[] = [];

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = synth()?.getVoices() ?? [];
  const lang = SPEECH_LANG.slice(0, 2).toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  for (const pref of VOICE_PREFERENCES) {
    const hit = candidates.find((v) => v.name.toLowerCase().includes(pref));
    if (hit) return hit;
  }
  return (
    candidates.find((v) => v.lang.toLowerCase() === SPEECH_LANG.toLowerCase()) ??
    candidates[0] ??
    null
  );
}

function hasUserActivation(): boolean {
  const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
  return nav.userActivation ? nav.userActivation.hasBeenActive : true;
}

function speakNow(text: string): void {
  const s = synth();
  if (!s) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_LANG;
  if (voice) u.voice = voice;
  u.rate = 1;
  u.pitch = 1;
  inFlight += 1;
  const finished = () => {
    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) useSpeakerStore.setState({ speaking: false });
  };
  u.onstart = () => useSpeakerStore.setState({ speaking: true });
  u.onend = finished;
  u.onerror = finished;
  s.speak(u);
}

function playPending(): void {
  const items = pending;
  pending = [];
  useSpeakerStore.setState({ needsTap: false });
  items.forEach(speakNow);
}

export const speaker = {
  /** Call once from the Talk screen. Safe to call again. */
  init(): void {
    if (initialised) return;
    initialised = true;
    const s = synth();
    if (!s) return;
    let enabled = true;
    try {
      enabled = localStorage.getItem(VOICE_ENABLED_KEY) !== "off";
    } catch {
      /* private mode */
    }
    const refresh = () => {
      voice = pickVoice();
      useSpeakerStore.setState({ available: true, voiceName: voice?.name ?? null });
    };
    refresh();
    s.addEventListener("voiceschanged", refresh);
    useSpeakerStore.setState({ enabled });
    // Any tap unlocks sentences that were held back for lack of user activation.
    window.addEventListener("pointerdown", () => pending.length && playPending(), {
      capture: true,
    });
  },

  /** Queue one sentence. Silently ignored when voice is off or unavailable. */
  say(text: string): void {
    const { enabled, available } = useSpeakerStore.getState();
    if (!enabled || !available || !text.trim()) return;
    if (!hasUserActivation()) {
      pending.push(text);
      useSpeakerStore.setState({ needsTap: true });
      return;
    }
    speakNow(text);
  },

  /** Speak one phrase on request (a hint's listen button), even when voice is switched off. */
  preview(text: string): void {
    if (!useSpeakerStore.getState().available || !text.trim()) return;
    speaker.cancel();
    speakNow(text);
  },

  /** Stop talking and forget anything queued. */
  cancel(): void {
    pending = [];
    inFlight = 0;
    synth()?.cancel();
    useSpeakerStore.setState({ speaking: false, needsTap: false });
  },

  tapToPlay(): void {
    playPending();
  },

  setEnabled(value: boolean): void {
    try {
      localStorage.setItem(VOICE_ENABLED_KEY, value ? "on" : "off");
    } catch {
      /* private mode */
    }
    useSpeakerStore.setState({ enabled: value });
    if (!value) speaker.cancel();
  },
};
