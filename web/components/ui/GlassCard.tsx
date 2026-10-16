import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Near-white card, like the hero cards in the references. */
  strong?: boolean;
  /** Default inner padding; turn off to lay out rows yourself. */
  padded?: boolean;
};

export function GlassCard({ strong, padded = true, className, children, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "relative overflow-hidden rounded-card",
        padded && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
