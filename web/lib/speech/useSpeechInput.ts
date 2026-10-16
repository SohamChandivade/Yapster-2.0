"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_LANG } from "./config";

/* Minimal typings for the Web Speech API; TypeScript's DOM lib does not ship them. */
type ResultAlt = { transcript: string };
type ResultItem = ArrayLike<ResultAlt> & { isFinal: boolean };
type ResultEvent = { resultIndex: number; results: ArrayLike<ResultItem> };
type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognizerCtor = new () => Recognizer;

function getCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognizerCtor;
    webkitSpeechRecognition?: RecognizerCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings.",
  "service-not-allowed": "Speech recognition is not allowed here.",
  "audio-capture": "No microphone was found.",
  network: "Speech recognition needs an internet connection.",
  "language-not-supported": "This browser cannot recognise German speech.",
};

export type SpeechInput = {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  dismissError: () => void;
};

/**
 * Tap-to-toggle German speech recognition. One utterance per tap: recognition ends
 * on silence (or a second tap) and the final transcript is handed to `onFinal`.
 */
export function useSpeechInput(onFinal: (text: string) => void): SpeechInput {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognizer | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    setInterim("");
    setError(null);

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const item = e.results[i];
        const text = item[0]?.transcript ?? "";
        if (item.isFinal) finalRef.current += text;
        else partial += text;
      }
      setInterim(`${finalRef.current} ${partial}`.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "aborted" || e.error === "no-speech") return;
      setError(ERRORS[e.error] ?? `Speech recognition failed (${e.error}).`);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      finalRef.current = "";
      if (text) onFinalRef.current(text);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setError("Could not start the microphone.");
    }
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return {
    supported,
    listening,
    interim,
    error,
    start,
    stop,
    toggle,
    dismissError: () => setError(null),
  };
}
