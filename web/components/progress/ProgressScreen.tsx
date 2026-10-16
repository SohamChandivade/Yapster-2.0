"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { GlassCard } from "@/components/ui/GlassCard";
import { ChevronRightIcon } from "@/components/ui/icons";
import { PillLink } from "@/components/ui/Pill";
import { api, ApiError, type Progress } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { cn } from "@/lib/cn";

/* ── helpers ──────────────────────────────────────────────────────── */

function humanTag(tag: string): string {
  const t = tag.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function localDate(iso: string): Date {
  // "2026-10-16" is a calendar day, not an instant: build it in local time.
  return iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const shortFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function Tip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "glass-strong pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-pill px-2.5 py-1 text-[11px] whitespace-nowrap text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-[12px] text-ink-muted">
      <summary className="cursor-pointer select-none">Show as table</summary>
      <table className="mt-2 w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-ink/10 py-1 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border-b border-ink/5 py-1 pr-3 text-ink tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/* ── calendar: magnitude per day, one warm hue light → dark ─────────── */

function bin(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 5) return 1;
  if (minutes < 10) return 2;
  if (minutes < 20) return 3;
  return 4;
}

function Calendar({ days }: { days: Progress["days"] }) {
  const [active, setActive] = useState<number | null>(null);
  const first = localDate(days[0]?.date ?? new Date().toISOString().slice(0, 10));
  const offset = (first.getDay() + 6) % 7; // Monday first
  const cells: (Progress["days"][number] | null)[] = [...Array<null>(offset).fill(null), ...days];
  const active_days = days.filter((d) => d.sessions > 0);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-ink-muted" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5" role="group" aria-label="Last five weeks">
        {cells.map((d, i) =>
          d === null ? (
            <span key={`pad-${i}`} aria-hidden />
          ) : (
            <button
              key={d.date}
              type="button"
              data-active={d.sessions > 0 || undefined}
              aria-label={`${dayFmt.format(localDate(d.date))}: ${d.minutes} min, ${d.sessions} ${d.sessions === 1 ? "session" : "sessions"}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="relative aspect-square rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
              style={{ background: d.sessions > 0 ? `var(--viz-ramp-${bin(d.minutes)})` : "var(--viz-empty)" }}
            >
              {active === i && (
                <Tip className={cn(i % 7 === 0 && "left-0 translate-x-0", i % 7 === 6 && "left-auto right-0 translate-x-0")}>
                  {shortFmt.format(localDate(d.date))} · {d.minutes} min · {d.sessions}{" "}
                  {d.sessions === 1 ? "session" : "sessions"}
                </Tip>
              )}
            </button>
          ),
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink-muted" aria-hidden>
        <span>Less</span>
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className="h-3 w-3 rounded-[3px]" style={{ background: `var(--viz-ramp-${b})` }} />
        ))}
        <span>More</span>
      </div>
      <TableView
        caption="Days with a session in the last five weeks"
        head={["Day", "Minutes", "Sessions"]}
        rows={active_days.map((d) => [dayFmt.format(localDate(d.date)), d.minutes, d.sessions])}
      />
    </div>
  );
}

/* ── weak spots: small multiples, one series colour, shared scale ───── */

function WeakSpots({ weeks, items }: { weeks: string[]; items: Progress["weak_spots"] }) {
  if (items.length === 0) {
    return <p className="text-[14px] text-ink-muted">No notes in the last four weeks. Keep talking and they will show up here.</p>;
  }
  const max = Math.max(1, ...items.flatMap((t) => t.weekly));
  const weekLabel = (i: number) => (i === weeks.length - 1 ? "This week" : shortFmt.format(localDate(weeks[i])));

  return (
    <div>
      <ul className="space-y-4" aria-label="Weak spots by week">
        {items.map((t) => (
          <li key={t.grammar_tag} className="flex items-end gap-3">
            <div className="w-[104px] shrink-0 pb-1">
              <p className="text-[14px] leading-tight font-medium">{humanTag(t.grammar_tag)}</p>
              <p className="text-[11px] text-ink-muted">{t.total} in 4 weeks</p>
            </div>
            <div
              className="flex h-14 flex-1 items-end gap-2 border-b border-[var(--viz-grid)]"
              role="img"
              aria-label={`${humanTag(t.grammar_tag)}: ${t.weekly.join(", ")} notes per week`}
            >
              {t.weekly.map((n, i) => (
                <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  {i === t.weekly.length - 1 && n > 0 && (
                    <span className="mb-0.5 text-[11px] text-ink-muted tabular-nums">{n}</span>
                  )}
                  <div
                    className="w-full max-w-[24px] rounded-t-[4px]"
                    style={{
                      height: n > 0 ? `${Math.max(8, (n / max) * 100)}%` : 2,
                      background: n > 0 ? "var(--viz-series-a)" : "var(--viz-empty)",
                    }}
                  />
                  <Tip className="hidden group-hover:block">
                    {weekLabel(i)} · {n} {n === 1 ? "note" : "notes"}
                  </Tip>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 ml-[116px] flex gap-2 text-[10px] text-ink-muted" aria-hidden>
        {weeks.map((w, i) => (
          <span key={w} className="flex-1 text-center">
            {weekLabel(i)}
          </span>
        ))}
      </div>
      <TableView
        caption="Notes per grammar tag and week"
        head={["Tag", ...weeks.map((_, i) => weekLabel(i)), "Total"]}
        rows={items.map((t) => [humanTag(t.grammar_tag), ...t.weekly, t.total])}
      />
    </div>
  );
}

/* ── vocabulary: single-series line with crosshair tooltip ───────────── */

function niceCeil(n: number): number {
  if (n <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(n));
  const unit = n / mag <= 2 ? 2 : n / mag <= 5 ? 5 : 10;
  return unit * mag;
}

function VocabLine({ points }: { points: Progress["vocab"] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = 128;
  const padL = 30;
  const padR = 40;
  const padT = 14;
  const padB = 24;
  const n = points.length;
  const top = niceCeil(Math.max(1, ...points.map((p) => p.owned)));
  const x = (i: number) => padL + (n > 1 ? (i / (n - 1)) * (W - padL - padR) : 0);
  const y = (v: number) => padT + (1 - v / top) * (H - padT - padB);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.owned).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = points[n - 1]?.owned ?? 0;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < n; i += 1) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setActive(best);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-ink"
        role="img"
        aria-label={`Words owned over the last eight weeks, now ${last}`}
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
      >
        {[0, top].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3.5} fontSize={10} textAnchor="end" fill="var(--ink-muted)">
              {v}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--viz-series-b)" opacity={0.1} />
        <path d={line} fill="none" stroke="var(--viz-series-b)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={padT} y2={y(0)} stroke="var(--viz-axis)" strokeWidth={1} />
        )}
        {points.map((p, i) => (
          <circle
            key={p.week_start}
            cx={x(i)}
            cy={y(p.owned)}
            r={active === i ? 5 : 4}
            fill="var(--viz-series-b)"
            stroke="var(--viz-surface)"
            strokeWidth={2}
            data-point
          />
        ))}
        <text x={x(n - 1) + 9} y={y(last) + 4} fontSize={11} fill="currentColor">
          {last}
        </text>
        <text x={x(0)} y={H - 6} fontSize={10} textAnchor="start" fill="var(--ink-muted)">
          {points[0] ? shortFmt.format(localDate(points[0].week_start)) : ""}
        </text>
        <text x={x(n - 1)} y={H - 6} fontSize={10} textAnchor="middle" fill="var(--ink-muted)">
          This week
        </text>
      </svg>
      {active !== null && points[active] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(points[active].owned) / H) * 100}%`, marginTop: -8 }}
        >
          <span className="glass-strong rounded-pill px-2.5 py-1 text-[11px] whitespace-nowrap text-ink">
            {active === n - 1 ? "This week" : shortFmt.format(localDate(points[active].week_start))} · {points[active].owned}{" "}
            words
          </span>
        </div>
      )}
      <TableView
        caption="Words owned at the end of each week"
        head={["Week of", "Words owned"]}
        rows={points.map((p) => [shortFmt.format(localDate(p.week_start)), p.owned])}
      />
    </div>
  );
}

/* ── screen ──────────────────────────────────────────────────────────── */

export function ProgressScreen() {
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .progress()
      .then((p) => {
        if (!cancelled) setData(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          window.location.assign("/welcome");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load your progress.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = data?.totals;

  return (
    <main
      className="relative mx-auto min-h-dvh max-w-[480px] px-6 pb-36"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <Backdrop variant="cool" />
      <h1 className="mt-7 text-[34px] leading-[1.18] font-normal tracking-[-0.025em]">Progress</h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        {error ?? (!data ? "Loading…" : totals && totals.sessions === 0 ? "Nothing yet. Your first talk starts the clock." : `${totals?.sessions} ${totals?.sessions === 1 ? "session" : "sessions"} · ${totals?.minutes} min · ${totals?.words} words · ${totals?.corrections} notes`)}
      </p>

      {data && (
        <div className="mt-6 flex items-end gap-3" aria-label="Current streak">
          <span className="text-[48px] leading-none font-light tracking-[-0.03em]">{data.streak_days}</span>
          <span className="pb-1.5 text-[13px] leading-tight text-ink-muted">
            day streak
            <br />
            best {data.best_streak}
          </span>
        </div>
      )}

      {data && totals && totals.sessions === 0 && (
        <GlassCard strong className="mt-6 flex items-center gap-4">
          <Blob size={56} palette="cool" expression="happy" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">Your charts fill up as you talk.</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">Five minutes is enough to light up the first day.</p>
          </div>
          <PillLink href="/talk" size="sm">
            Talk
          </PillLink>
        </GlassCard>
      )}

      {data && (
        <>
          <section className="mt-6" aria-label="Calendar">
            <h2 className="mb-3 text-[12px] text-ink-muted">Last five weeks</h2>
            <GlassCard strong>
              <Calendar days={data.days} />
            </GlassCard>
          </section>

          <section className="mt-6" aria-label="Weak spots">
            <h2 className="mb-3 text-[12px] text-ink-muted">Weak spots · notes per week</h2>
            <GlassCard strong>
              <WeakSpots weeks={data.weeks} items={data.weak_spots} />
            </GlassCard>
          </section>

          <section className="mt-6" aria-label="Vocabulary">
            <h2 className="mb-3 text-[12px] text-ink-muted">Words owned · last eight weeks</h2>
            <GlassCard strong>
              <VocabLine points={data.vocab} />
            </GlassCard>
          </section>

          <section className="mt-6" aria-label="History">
            <h2 className="mb-3 text-[12px] text-ink-muted">Sessions</h2>
            {data.sessions.length === 0 ? (
              <GlassCard>
                <p className="text-[14px] text-ink-muted">No finished sessions yet.</p>
              </GlassCard>
            ) : (
              <GlassCard strong padded={false}>
                <ul>
                  {data.sessions.map((s, i) => (
                    <li key={s.session_id} className={cn(i > 0 && "border-t border-ink/8")}>
                      <Link
                        href={`/recap/${s.session_id}`}
                        className="flex items-center gap-3 px-5 py-3.5 active:bg-ink/5"
                        aria-label={`Recap: ${s.scenario_title}, ${s.minutes} min, ${s.notes} notes`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium">{s.scenario_title}</p>
                          <p className="text-[12px] text-ink-muted">
                            {dayFmt.format(new Date(s.ended_at))} · {s.minutes} min · {s.notes} {s.notes === 1 ? "note" : "notes"}
                          </p>
                        </div>
                        {s.fluency_score !== null && (
                          <span className="text-[15px] font-medium tabular-nums">{s.fluency_score}</span>
                        )}
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}
          </section>
        </>
      )}
    </main>
  );
}
