import { cn } from "@/lib/cn";
import { GlassCard } from "./GlassCard";
import { Glow } from "./Glow";

type StatTileProps = {
  label: string;
  value: string;
  sub?: string;
  /** Internal glow colour, as in the Veri tiles. */
  glow?: string;
  className?: string;
};

export function StatTile({ label, value, sub, glow, className }: StatTileProps) {
  return (
    <GlassCard strong padded={false} className={cn("flex min-h-[112px] flex-col justify-between p-3.5", className)}>
      {glow && <Glow color={glow} size={150} blur={36} opacity={0.85} className="-right-12 -bottom-16" />}
      <span className="relative text-[11px] leading-tight text-ink-muted">{label}</span>
      <div className="relative">
        <span className="block text-[26px] font-light leading-none tracking-[-0.02em] tabular-nums">{value}</span>
        {sub && <span className="mt-1 block truncate text-[11px] text-ink-muted">{sub}</span>}
      </div>
    </GlassCard>
  );
}
