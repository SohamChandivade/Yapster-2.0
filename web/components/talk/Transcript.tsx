"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { LightbulbIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { Line } from "@/lib/talkStore";

type Props = {
  lines: Line[];
  speaking: boolean;
  /** Show the English meaning under every tutor line (beginner mode). */
  showEnglish?: boolean;
  /** Every tutor line gets a Hint chip; the latest one is prominent, earlier ones compact. */
  onHint?: (lineId: string) => void;
  hintLoading?: boolean;
  hintsDisabled?: boolean;
  className?: string;
};

/** Light centred text under the Blob. No bubbles. Tutor in ink, learner muted. */
export function Transcript({
  lines,
  speaking,
  showEnglish,
  onHint,
  hintLoading,
  hintsDisabled,
  className,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = lines[lines.length - 1];
  const lastLength = last?.text.length ?? 0;
  const lastTutorId = [...lines].reverse().find((l) => l.role === "tutor")?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lines.length, lastLength, showEnglish]);

  return (
    <div
      className={cn("no-scrollbar w-full overflow-y-auto", className)}
      aria-label="Transcript"
      aria-live="polite"
    >
      <ol className="flex flex-col gap-4 py-2">
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          const hintable = onHint && line.role === "tutor";
          const latest = line.id === lastTutorId;
          return (
            <motion.li
              key={line.id}
              data-role={line.role}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-center"
            >
              <p
                lang="de"
                className={cn(
                  "leading-relaxed",
                  line.role === "tutor" ? "text-[18px] text-ink" : "text-[15px] text-ink-muted",
                )}
              >
                {line.text}
                {isLast && speaking && line.role === "tutor" && (
                  <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-ink/60 align-middle" />
                )}
              </p>
              {showEnglish && line.role === "tutor" && line.en && (
                <p className="mt-1 text-[13px] leading-snug text-ink-muted" data-english>
                  {line.en}
                </p>
              )}
              {hintable && (
                <button
                  type="button"
                  onClick={() => onHint(line.id)}
                  disabled={hintLoading || hintsDisabled}
                  aria-label={latest ? "Hint for this line" : "Hint for an earlier line"}
                  className={cn(
                    "glass-chip mt-2 inline-flex items-center gap-1.5 rounded-pill font-medium text-ink transition-opacity disabled:opacity-50",
                    latest ? "h-8 px-3 text-[12px]" : "h-7 px-2.5 text-[11px] text-ink-muted",
                  )}
                >
                  <LightbulbIcon className={latest ? "h-4 w-4" : "h-3.5 w-3.5"} />
                  {latest ? (hintLoading ? "Thinking…" : "Hint") : null}
                </button>
              )}
            </motion.li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
