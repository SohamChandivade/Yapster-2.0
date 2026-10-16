"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { Line } from "@/lib/talkStore";

type Props = { lines: Line[]; speaking: boolean; className?: string };

/** Light centred text under the Blob. No bubbles. Tutor in ink, learner muted. */
export function Transcript({ lines, speaking, className }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = lines[lines.length - 1];
  const lastLength = last?.text.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [lines.length, lastLength]);

  return (
    <div
      className={cn("no-scrollbar w-full overflow-y-auto", className)}
      aria-label="Transcript"
      aria-live="polite"
    >
      <ol className="flex flex-col gap-4 py-2">
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          return (
            <motion.li
              key={line.id}
              data-role={line.role}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              lang="de"
              className={cn(
                "text-center leading-relaxed",
                line.role === "tutor" ? "text-[18px] text-ink" : "text-[15px] text-ink-muted",
              )}
            >
              {line.text}
              {isLast && speaking && line.role === "tutor" && (
                <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-ink/60 align-middle" />
              )}
            </motion.li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
