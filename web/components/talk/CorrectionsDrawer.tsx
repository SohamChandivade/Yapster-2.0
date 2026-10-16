"use client";

import { Sheet } from "@/components/ui/Sheet";
import type { Correction } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  corrections: Correction[];
  tutorName: string;
};

/** The notes the tutor kept to itself during the talk. */
export function CorrectionsDrawer({ open, onClose, corrections, tutorName }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Notes so far">
      {corrections.length === 0 ? (
        <p className="text-[14px] text-ink-muted">
          Nothing yet. Keep talking, {tutorName || "your tutor"} is listening.
        </p>
      ) : (
        <ol className="no-scrollbar max-h-[55dvh] space-y-3 overflow-y-auto pb-1">
          {corrections.map((c) => (
            <li key={c.id} className="glass rounded-card p-4">
              <p className="text-[13px] text-ink-muted line-through decoration-ink/30" lang="de">
                {c.you_said}
              </p>
              <p className="mt-1 text-[16px] font-medium" lang="de">
                {c.native}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{c.why}</p>
              <span className="mt-2 inline-block rounded-pill bg-ink/8 px-2 py-0.5 text-[11px]">
                {c.grammar_tag.replaceAll("_", " ")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
