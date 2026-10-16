"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

type Props = { level: string; disabled?: boolean; onNudge: (delta: -1 | 1) => void };

/** Tiny level indicator the learner can nudge; the system adjusts it automatically too. */
export function DifficultyPill({ level, disabled, onNudge }: Props) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-opacity disabled:opacity-30";
  return (
    <div className="glass-strong flex h-10 items-center rounded-pill px-1" aria-label="Difficulty">
      <button type="button" aria-label="Easier" disabled={disabled} onClick={() => onNudge(-1)} className={btn}>
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <span className="min-w-[28px] text-center text-[13px] font-medium tabular-nums" aria-live="polite">
        {level || "…"}
      </span>
      <button type="button" aria-label="Harder" disabled={disabled} onClick={() => onNudge(1)} className={btn}>
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
