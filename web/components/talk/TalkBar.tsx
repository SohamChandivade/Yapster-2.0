"use client";

import { type FormEvent, useState } from "react";
import { ArrowUpIcon, CloseIcon, SparkleIcon } from "@/components/ui/icons";

type Props = {
  disabled: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  onHelp: () => void;
  onEnd: () => void;
};

/** Bottom glass pill: typed input (mic arrives in milestone 3), Help, End. */
export function TalkBar({ disabled, busy, onSend, onHelp, onEnd }: Props) {
  const [text, setText] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || disabled) return;
    onSend(clean);
    setText("");
  }

  return (
    <form onSubmit={submit} className="glass-strong flex items-center gap-1.5 rounded-pill p-1.5 pl-4">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder={busy ? "…" : "Schreib auf Deutsch…"}
        aria-label="Your message in German"
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="send"
        lang="de"
        className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted/70"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || !text.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-30"
      >
        <ArrowUpIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onHelp}
        aria-label="Help me say this"
        className="flex h-10 shrink-0 items-center gap-1 rounded-pill bg-ink/8 px-3 text-[13px] font-medium"
      >
        <SparkleIcon className="h-4 w-4" />
        Help
      </button>
      <button
        type="button"
        onClick={onEnd}
        aria-label="End session"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/8"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
