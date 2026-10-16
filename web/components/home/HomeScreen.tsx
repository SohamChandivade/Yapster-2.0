"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { GlassCard } from "@/components/ui/GlassCard";
import { Glow } from "@/components/ui/Glow";
import { ArrowRightIcon, CalendarIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { PillLink } from "@/components/ui/Pill";
import { StatTile } from "@/components/ui/StatTile";
import { api, ApiError, type Dashboard } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { scenarios } from "@/lib/scenarios";

const two = (n: number) => Math.round(n).toString().padStart(2, "0");

function humanTag(tag: string): string {
  const t = tag.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/** Home / dashboard (reference image 5). Every number comes from the API; every element leads somewhere. */
export function HomeScreen() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    api
      .dashboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          window.location.assign("/welcome");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load your dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  async function discardOpen(id: string) {
    setDiscarding(true);
    try {
      await api.discard(id);
    } catch {
      /* already gone */
    }
    setDiscarding(false);
    load();
  }

  const name = data?.user.name ?? "";
  const initial = name ? name[0].toUpperCase() : "·";
  const tutor = data?.user.tutor_name ?? "Lena";
  const last = data?.last_session ?? null;
  const next = data?.next_session;
  const weak = data?.weak_spot ?? null;
  const open = data?.open_session ?? null;
  const talkHref = next ? `/talk?scenario=${next.scenario}` : "/talk";

  const subline = !data
    ? (error ?? "Loading…")
    : last
      ? `Day ${data.day} · last session ${last.minutes} min`
      : `Day ${data.day} · your first session takes five minutes`;

  return (
    <main
      className="relative mx-auto min-h-dvh max-w-[480px] px-6 pb-36"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <Backdrop />
      <Glow
        color="var(--glow-amber)"
        to="var(--glow-peach)"
        size={560}
        blur={64}
        opacity={0.85}
        className="top-[250px] left-[calc(50%-280px)]"
        drift={2}
      />
      <Glow color="var(--glow-lilac)" size={300} blur={50} opacity={0.5} className="top-[440px] -right-32" drift={3} />

      <header className="relative flex items-center justify-between">
        <Blob size={40} palette="warm" expression="none" />
        <Link
          href="/profile"
          aria-label="Profile"
          className="glass-strong flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-[15px] font-medium"
        >
          {data?.user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.user.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initial
          )}
        </Link>
      </header>

      <h1 className="relative mt-7 text-[34px] leading-[1.18] font-normal tracking-[-0.025em]">
        Hallo{name ? `, ${name}` : ""}
        <br />
        Today&apos;s summary
      </h1>
      <p className="relative mt-2 text-[13px] text-ink-muted">{subline}</p>

      <div className="relative mt-7 flex items-center justify-between">
        <div className="flex items-end gap-3">
          <span className="text-[46px] leading-none font-light tracking-[-0.03em] tabular-nums">
            {data ? two(data.minutes_last_7_days) : "––"}
          </span>
          <span className="text-[46px] leading-none font-light tracking-[-0.03em] text-ink-muted/70 tabular-nums">
            {data ? two(data.weekly_goal_minutes) : "––"}
          </span>
          <span className="pb-1 pl-1 text-[12px] leading-[1.3] text-ink-muted">
            Minutes spoken
            <br />
            past 7 days · goal
          </span>
        </div>
        <Link
          href="/progress"
          aria-label="Open progress"
          className="glass-strong flex h-11 w-11 items-center justify-center rounded-full text-ink transition-transform duration-200 ease-out active:scale-95"
        >
          <CalendarIcon className="h-5 w-5" />
        </Link>
      </div>

      {open && (
        <GlassCard strong padded={false} className="mt-6" aria-label="Unfinished conversation">
          <div className="flex items-center gap-3 p-4">
            <Blob size={36} palette="warm" expression="neutral" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink-muted">Unfinished · {ago(open.started_at)}</p>
              <p className="truncate text-[15px] font-medium">
                {open.scenario_title} · {open.turns} {open.turns === 1 ? "turn" : "turns"}
              </p>
            </div>
            <PillLink href={`/talk?session=${open.session_id}`} size="sm">
              Continue
            </PillLink>
            <button
              type="button"
              aria-label="Discard unfinished conversation"
              disabled={discarding}
              onClick={() => void discardOpen(open.session_id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink disabled:opacity-40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </GlassCard>
      )}

      <GlassCard strong padded={false} className={open ? "mt-4" : "mt-7"}>
        <div className="absolute top-6 right-5">
          <Blob size={84} palette="warm" expression="none" />
        </div>
        <div className="p-5 pr-32">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{tutor}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">Your German tutor</p>
        </div>
        <div className="flex gap-6 px-5 pt-1 pb-5">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-muted">Next session</p>
            <p className="mt-0.5 truncate text-[15px] font-medium">{next ? next.scenario_title : "…"}</p>
          </div>
          <div className="min-w-0 border-l border-ink/10 pl-6">
            <p className="text-[12px] text-ink-muted">Last session</p>
            {last ? (
              <Link
                href={`/recap/${last.session_id}`}
                className="mt-0.5 flex items-center gap-0.5 text-[15px] font-medium"
                aria-label={`Open the recap of your last session, ${last.scenario_title}`}
              >
                <span className="truncate">
                  {last.minutes} min · {last.notes} {last.notes === 1 ? "note" : "notes"}
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-muted" />
              </Link>
            ) : (
              <p className="mt-0.5 truncate text-[15px] font-medium">{data ? "None yet" : "…"}</p>
            )}
          </div>
        </div>
        <Link
          href={talkHref}
          className="flex items-center justify-between border-t border-ink/8 px-5 py-4 text-[15px] font-medium transition-colors active:bg-ink/5"
        >
          Start talking
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
      </GlassCard>
      {next && (
        <p className="relative mt-2 px-1 text-[12px] text-ink-muted">
          {next.reason} · about {next.minutes} min.
        </p>
      )}

      <section className="relative mt-4 grid grid-cols-3 gap-3" aria-label="Stats">
        <Link href="/progress" className="block" aria-label="Streak, see progress">
          <StatTile
            label="Streak"
            value={data ? `${data.streak_days}` : "–"}
            sub={data?.streak_days === 1 ? "day" : "days"}
            glow="var(--glow-amber)"
            className="h-full"
          />
        </Link>
        <Link href="/progress" className="block" aria-label="Words owned, see progress">
          <StatTile
            label="Words owned"
            value={data ? `${data.words_owned}` : "–"}
            sub={data ? `+${data.words_last_7_days} this week` : ""}
            glow="var(--glow-mint)"
            className="h-full"
          />
        </Link>
        <Link href="/progress" className="block" aria-label="Weak spot, see progress">
          <StatTile
            label="Weak spot"
            value={!data ? "–" : weak ? humanTag(weak.grammar_tag) : "None"}
            sub={!data ? "" : weak ? `${weak.count}× this month` : "keep talking"}
            glow="var(--glow-lilac)"
            className="h-full"
          />
        </Link>
      </section>

      <section className="relative mt-8" aria-label="Scenarios">
        <div className="flex items-end justify-between">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em]">Pick a scenario</h3>
          <Link href="/scenarios" className="text-[13px] text-ink-muted">
            See all
          </Link>
        </div>
        <div className="no-scrollbar -mx-6 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
          {scenarios.map(({ slug, title, minutes, vivid: [a, b, c] }) => (
            <Link
              key={slug}
              href={`/talk?scenario=${slug}`}
              className="relative flex h-[184px] w-[150px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-card p-4 transition-transform duration-200 active:scale-[0.98]"
              style={{ background: `linear-gradient(160deg, ${a} 0%, ${b} 55%, ${c} 100%)` }}
            >
              <Glow color="rgba(255,255,255,0.95)" size={170} blur={28} opacity={0.75} className="-top-14 -left-10" />
              <Glow color={c} size={190} blur={26} opacity={1} className="-right-14 -bottom-14" />
              <span className="glass-chip relative self-start rounded-pill px-2.5 py-1 text-[11px] font-medium">
                {minutes} min
              </span>
              <span className="relative text-[17px] leading-tight font-semibold">{title}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
