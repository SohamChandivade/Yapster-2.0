"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/** Subtle top-right counter; pops a little every time a note is added. */
export function NotesChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <motion.button
      key={count}
      type="button"
      onClick={onClick}
      aria-label={`${count} ${count === 1 ? "note" : "notes"}, open`}
      initial={{ scale: count ? 1.18 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className="glass-strong flex h-10 items-center gap-2 rounded-pill px-3.5 text-[13px] font-medium"
    >
      <span className={cn("h-2 w-2 rounded-full", count ? "bg-peach" : "bg-ink/20")} />
      {count} {count === 1 ? "note" : "notes"}
    </motion.button>
  );
}
