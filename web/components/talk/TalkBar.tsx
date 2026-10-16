"use client";

import { motion } from "framer-motion";
import { type FormEvent, useState } from "react";
import { ArrowUpIcon, CloseIcon, MicIcon, SparkleIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { SpeechInput } from "@/lib/speech/useSpeechInput";

type Props = {
  disabled: boolean;
  busy: boolean;
  mic: SpeechInput;
  onSend: (text: string) => void;
  onHelp: () => void;
  onEnd: () => void;
};

/** Bottom glass pill: mic (tap to talk), typed fallback, Help, End. */
export function TalkBar({ disabled, busy, mic, onSend, onHelp, onEnd }: Props) {
  const [text, setText] = useState("");
  const listening = mic.listening;

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || disabled || listening) return;
    onSend(clean);
    setText("");
  }

  const round =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[transform,opacity] duration-200 ease-out active:scale-95 disabled:opacity-30";

  return (
    <form
      onSubmit={submit}
      className="glass-strong flex items-center gap-1.5 rounded-pill p-1.5 pl-1.5"
      aria-label="Talk controls"
    >
      {mic.supported && (
        <motion.button
          type="button"
          onClick={mic.toggle}
          disabled={disabled && !listening}
          aria-label={listening ? "Stop listening" : "Talk"}
          aria-pressed={listening}
          animate={listening ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={listening ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
          className={cn(round, listening ? "bg-[#E8557E] text-white" : "bg-ink/8 text-ink")}
        >
          <MicIcon className="h-5 w-5" />
        </motion.button>
      )}
      <input
        value={listening ? mic.interim : text}
        onChange={(e) => setText(e.target.value)}
        readOnly={listening}
        disabled={disabled && !listening}
        placeholder={listening ? "Listening…" : busy ? "…" : mic.supported ? "Or type…" : "Schreib auf Deutsch…"}
        aria-label="Your message in German"
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="send"
        lang="de"
        className={cn(
          "min-w-0 flex-1 bg-transparent pl-2 text-[16px] text-ink outline-none placeholder:text-ink-muted/70",
          listening && "text-ink-muted",
        )}
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || listening || !text.trim()}
        className={cn(round, "bg-ink text-bg")}
      >
        <ArrowUpIcon className="h-5 w-5" />
      </button>
      <button type="button" onClick={onHelp} aria-label="Help me say this" className={cn(round, "bg-ink/8")}>
        <SparkleIcon className="h-[18px] w-[18px]" />
      </button>
      <button type="button" onClick={onEnd} aria-label="End session" className={cn(round, "bg-ink/8")}>
        <CloseIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
