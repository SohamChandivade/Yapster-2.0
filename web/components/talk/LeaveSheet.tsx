"use client";

import { Pill } from "@/components/ui/Pill";
import { Sheet } from "@/components/ui/Sheet";

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onRecap: () => void;
  onDiscard: () => void;
};

/** Asked only when the learner has already said something. */
export function LeaveSheet({ open, busy, onClose, onRecap, onDiscard }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Leave the conversation?">
      <p className="text-[14px] leading-relaxed text-ink-muted">
        You can end it now and see your notes, or throw it away as if it never happened.
      </p>
      <div className="mt-5 space-y-2">
        <Pill size="lg" className="w-full" onClick={onRecap} disabled={busy}>
          {busy ? "One moment…" : "See my recap"}
        </Pill>
        <Pill variant="glass" size="lg" className="w-full" onClick={onDiscard} disabled={busy}>
          Discard this session
        </Pill>
        <Pill variant="ghost" size="md" className="w-full text-ink-muted" onClick={onClose} disabled={busy}>
          Keep talking
        </Pill>
      </div>
    </Sheet>
  );
}
