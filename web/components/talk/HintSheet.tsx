"use client";

import { ArrowUpIcon, SpeakerIcon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";
import type { Hint } from "@/lib/api";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  tutorName: string;
  tutorLine: string;
  hint: Hint | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  canListen: boolean;
  showEnglish: boolean;
  onToggleEnglish: (value: boolean) => void;
  onListen: (german: string) => void;
  onUse: (german: string) => void;
};

/**
 * For learners below A1: what Lena just said, three things they could answer,
 * each with a listen button and a one-tap send, plus a beginner mode that keeps
 * English under every tutor line.
 */
export function HintSheet({
  open,
  onClose,
  tutorName,
  tutorLine,
  hint,
  loading,
  error,
  onRetry,
  canListen,
  showEnglish,
  onToggleEnglish,
  onListen,
  onUse,
}: Props) {
  const name = tutorName || "Lena";
  return (
    <Sheet open={open} onClose={onClose} title="Hint">
      <div className="no-scrollbar max-h-[62dvh] overflow-y-auto pb-1">
        <p className="text-[12px] text-ink-muted">{name} said</p>
        <div className="glass mt-1.5 rounded-card p-4">
          <p className="text-[16px] leading-snug" lang="de">
            {tutorLine}
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-muted">
            {hint?.translation ?? (loading ? "Translating…" : "")}
          </p>
        </div>

        <p className="mt-5 text-[12px] text-ink-muted">You could say</p>
        {error && !hint ? (
          <div className="mt-2">
            <p role="alert" className="text-[13px] leading-relaxed text-[#C2415F]">
              {error}
            </p>
            <Pill variant="glass" size="sm" className="mt-3" onClick={onRetry}>
              Try again
            </Pill>
          </div>
        ) : loading && !hint ? (
          <p className="mt-2 text-[14px] text-ink-muted">Thinking of a few replies…</p>
        ) : (
          <ul className="mt-1.5 space-y-2" aria-label="Suggested replies">
            {hint?.suggestions.map((s) => (
              <li key={s.german} className="glass-strong flex items-center gap-3 rounded-card p-3 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] leading-snug font-medium" lang="de">
                    {s.german}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">{s.english}</p>
                </div>
                {canListen && (
                  <button
                    type="button"
                    onClick={() => onListen(s.german)}
                    aria-label={`Listen: ${s.german}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink"
                  >
                    <SpeakerIcon className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onUse(s.german)}
                  aria-label={`Use: ${s.german}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg"
                >
                  <ArrowUpIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {hint?.tip && <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{hint.tip}</p>}

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-ink/8 pt-4">
          <div>
            <p className="text-[14px] font-medium">Show English under {name}&apos;s lines</p>
            <p className="text-[12px] text-ink-muted">Handy while everything is still new.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showEnglish}
            aria-label={`Show English under ${name}'s lines`}
            onClick={() => onToggleEnglish(!showEnglish)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-200",
              showEnglish ? "bg-ink" : "bg-ink/15",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-bg transition-[left] duration-200",
                showEnglish ? "left-6" : "left-1",
              )}
            />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
