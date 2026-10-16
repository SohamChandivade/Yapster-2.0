import { cn } from "@/lib/cn";

// Literal names so the Tailwind scanner and the plain CSS classes line up.
const DRIFT = { 1: "drift-1", 2: "drift-2", 3: "drift-3" } as const;

type GlowProps = {
  /** Core colour, usually `var(--glow-*)`. */
  color: string;
  /** Optional mid colour for a two-tone glow (core → to → transparent). */
  to?: string;
  /** Diameter in px. */
  size?: number;
  /** Positioning classes (absolute offsets). The parent must be `relative`. */
  className?: string;
  opacity?: number;
  blur?: number;
  /**
   * Slow drift-and-breathe animation (three staggered paths). Animates `transform`,
   * so do not combine with translate classes; position with offsets or margins instead.
   */
  drift?: 1 | 2 | 3;
};

/**
 * A radial glow: a blurred circle placed behind content, usually bleeding
 * off the screen edge. This is how every gradient in the app is built.
 */
export function Glow({ color, to, size = 360, className, opacity = 0.9, blur = 60, drift }: GlowProps) {
  const stops = to ? `${color} 0%, ${to} 42%, transparent 70%` : `${color} 0%, transparent 70%`;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full", drift && DRIFT[drift], className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at center, ${stops})`,
        filter: `blur(${blur}px)`,
        opacity,
      }}
    />
  );
}
