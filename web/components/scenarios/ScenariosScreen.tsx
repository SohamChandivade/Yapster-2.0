"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Glow } from "@/components/ui/Glow";
import { api, type Scenario } from "@/lib/api";
import { scenarios as palette } from "@/lib/scenarios";

type Card = Scenario & { vivid: [string, string, string] };

const FALLBACK: Card[] = palette.map((p) => ({ ...p, played: 0, last_played_at: null }));

/** Grid of full-bleed cards, title lower-left (CLAUDE.md §5.4), with play counts from the API. */
export function ScenariosScreen() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .scenarios()
      .then((list) => {
        if (cancelled) return;
        const colours = new Map(palette.map((p) => [p.slug, p.vivid]));
        setCards(list.map((s) => ({ ...s, vivid: colours.get(s.slug) ?? palette[0].vivid })));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load scenarios.");
        setCards(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const list = cards ?? FALLBACK;
  const played = list.reduce((n, s) => n + s.played, 0);

  return (
    <main
      className="relative mx-auto min-h-dvh max-w-[480px] px-6 pb-36"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <Backdrop />
      <h1 className="mt-7 text-[34px] leading-[1.18] font-normal tracking-[-0.025em]">Scenarios</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        {error
          ? error
          : !cards
            ? "Loading…"
            : played === 0
              ? "Pick a situation. Each one takes five to ten minutes."
              : `${played} ${played === 1 ? "conversation" : "conversations"} so far. Pick the next one.`}
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3" aria-label="Scenario list">
        {list.map(({ slug, title, blurb, minutes, played: n, vivid: [a, b, c] }) => (
          <li key={slug}>
            <Link
              href={`/talk?scenario=${slug}`}
              className="relative flex h-[196px] flex-col justify-between overflow-hidden rounded-card p-4 text-ink transition-transform duration-200 active:scale-[0.98]"
              style={{ background: `linear-gradient(160deg, ${a} 0%, ${b} 55%, ${c} 100%)` }}
            >
              <Glow color="rgba(255,255,255,0.95)" size={170} blur={28} opacity={0.75} className="-top-14 -left-10" />
              <Glow color={c} size={190} blur={26} opacity={1} className="-right-14 -bottom-14" />
              <div className="relative flex flex-wrap gap-1.5">
                <span className="glass-chip rounded-pill px-2.5 py-1 text-[11px] font-medium">{minutes} min</span>
                {n > 0 && (
                  <span className="glass-chip rounded-pill px-2.5 py-1 text-[11px] font-medium">Played {n}×</span>
                )}
              </div>
              <div className="relative">
                <h2 className="text-[17px] leading-tight font-semibold">{title}</h2>
                <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink/70">{blurb}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
