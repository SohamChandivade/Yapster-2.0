import { Glow } from "./Glow";

type BackdropProps = { variant?: "warm" | "cool" };

/**
 * Ambient glows behind a whole screen. Fixed to the viewport, so a desktop
 * window gets the gradient too instead of a flat frame around the column.
 * Kept soft, and always moving: each glow drifts on its own slow path so the
 * gradient breathes. Focused glows belong in the screen itself.
 */
export function Backdrop({ variant = "warm" }: BackdropProps) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {variant === "warm" ? (
        <>
          <Glow color="var(--glow-peach)" to="var(--glow-rose)" size={560} className="-top-72 -right-64" opacity={0.4} drift={1} />
          <Glow color="var(--glow-lilac)" size={520} className="top-[48%] -left-80" opacity={0.4} drift={2} />
          <Glow color="var(--glow-amber)" size={480} className="-bottom-56 right-[-14%]" opacity={0.35} drift={3} />
        </>
      ) : (
        <>
          <Glow color="var(--glow-sky)" to="var(--glow-lilac)" size={560} className="-top-72 -left-64" opacity={0.45} drift={2} />
          <Glow color="var(--glow-rose)" size={480} className="top-[46%] -right-80" opacity={0.35} drift={1} />
          <Glow color="var(--glow-mint)" size={460} className="-bottom-56 left-[4%]" opacity={0.4} drift={3} />
        </>
      )}
    </div>
  );
}
