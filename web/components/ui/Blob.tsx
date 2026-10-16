"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type BlobPalette = "warm" | "cool" | "mint" | "rose";
export type BlobExpression = "happy" | "neutral" | "sad" | "thinking" | "none";

type BlobProps = {
  /** Diameter in px. */
  size?: number;
  palette?: BlobPalette;
  expression?: BlobExpression;
  /** Pulses while the tutor is speaking. */
  speaking?: boolean;
  className?: string;
};

type Palette = { a: string; b: string; c: string; d: string };

const palettes: Record<BlobPalette, Palette> = {
  warm: { a: "var(--glow-rose)", b: "var(--glow-peach)", c: "var(--glow-lilac)", d: "var(--glow-sky)" },
  cool: { a: "var(--glow-sky)", b: "var(--glow-lilac)", c: "var(--glow-mint)", d: "var(--glow-rose)" },
  mint: { a: "var(--glow-mint)", b: "var(--glow-sky)", c: "var(--glow-lilac)", d: "var(--glow-peach)" },
  rose: { a: "var(--glow-rose)", b: "var(--glow-lilac)", c: "var(--glow-peach)", d: "var(--glow-mint)" },
};

/* Every mouth shares one path structure so framer can morph between them. */
const mouths: Record<Exclude<BlobExpression, "none">, string> = {
  happy: "M41 59 Q50 69 59 59",
  neutral: "M43 61.5 Q50 61.5 57 61.5",
  sad: "M41 65 Q50 56 59 65",
  thinking: "M44 63 Q50 60 56 63",
};

const INK = "#1C1B1A";

/**
 * The mascot: a glossy gradient sphere with an optional face.
 * Pulses when `speaking`, floats gently otherwise, blinks every few seconds.
 */
export function Blob({
  size = 160,
  palette = "warm",
  expression = "happy",
  speaking = false,
  className,
}: BlobProps) {
  const p = palettes[palette];

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      data-speaking={speaking || undefined}
      data-expression={expression}
    >
      {/* Halo: soft glow behind the sphere */}
      <motion.div
        aria-hidden
        className="absolute rounded-full"
        style={{
          inset: "-18%",
          background: `radial-gradient(circle at 40% 40%, ${p.a} 0%, ${p.c} 45%, transparent 70%)`,
          filter: "blur(28px)",
        }}
        animate={
          speaking
            ? { scale: [1, 1.18, 1.06, 1.2, 1], opacity: [0.75, 0.95, 0.8, 0.95, 0.75] }
            : { scale: 1, opacity: 0.75 }
        }
        transition={
          speaking
            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.35, ease: "easeOut" }
        }
      />

      {/* Sphere */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: [
            "radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 10%, rgba(255,255,255,0) 38%)",
            `radial-gradient(circle at 72% 78%, ${p.d} 0%, transparent 52%)`,
            `radial-gradient(circle at 22% 72%, ${p.c} 0%, transparent 50%)`,
            `linear-gradient(140deg, ${p.a} 0%, ${p.b} 45%, ${p.c} 100%)`,
          ].join(", "),
          boxShadow:
            "inset -10px -14px 28px rgba(90, 70, 160, 0.16), inset 8px 10px 18px rgba(255, 255, 255, 0.45)",
        }}
        animate={
          speaking
            ? { scale: [1, 1.05, 0.99, 1.04, 1], y: [0, -2, 0, -3, 0] }
            : { scale: 1, y: [0, -4, 0] }
        }
        transition={
          speaking
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {expression !== "none" && (
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <motion.g
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
              transition={{
                duration: 4,
                times: [0, 0.46, 0.5, 0.54, 1],
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: "easeInOut",
              }}
            >
              <circle cx="39" cy="47" r="3.4" fill={INK} />
              <circle cx="61" cy="47" r="3.4" fill={INK} />
            </motion.g>
            <motion.path
              d={mouths[expression]}
              animate={{ d: mouths[expression] }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              fill="none"
              stroke={INK}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </motion.div>
    </div>
  );
}
