"use client";

import { useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill, PillLink } from "@/components/ui/Pill";
import { StatTile } from "@/components/ui/StatTile";
import { api, type Recap } from "@/lib/api";

/** Veri-style tile grid in the cool palette (CLAUDE.md §5.5). */
export function RecapScreen({ sessionId }: { sessionId: string }) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    let cancelled = false;
    api
      .recap(sessionId)
      .then((r) => {
        if (!cancelled) setRecap(r);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the recap.");
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function saveWords() {
    if (!recap || saveState !== "idle") return;
    setSaveState("saving");
    try {
      await api.saveVocab(sessionId, recap.new_words.map((w) => w.word));
      setSaveState("saved");
    } catch (err) {
      setSaveState("idle");
      setError(err instanceof Error ? err.message : "Could not save words.");
    }
  }

  if (!recap) {
    return (
      <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
        <Backdrop variant="cool" />
        <Blob size={120} palette="cool" expression={error ? "sad" : "thinking"} />
        <p className="mt-6 text-[14px] text-ink-muted">{error ?? "Reading your session…"}</p>
        {error && (
          <PillLink href="/" variant="glass" className="mt-6">
            Back home
          </PillLink>
        )}
      </main>
    );
  }

  return (
    <main
      className="relative mx-auto min-h-dvh max-w-[480px] px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
      }}
    >
      <Backdrop variant="cool" />

      <header className="flex items-center justify-between">
        <Blob size={40} palette="cool" expression="none" />
        <PillLink href="/" variant="glass" size="sm">
          Done
        </PillLink>
      </header>

      <p className="mt-7 text-[12px] text-ink-muted">
        {recap.scenario_title} · with {recap.tutor_name}
      </p>
      <h1 className="mt-1 text-[34px] leading-[1.18] font-normal tracking-[-0.025em]">
        Session recap
      </h1>
      {recap.summary && (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted" lang="de">
          {recap.summary}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3" aria-label="Session stats">
        <StatTile label="Minutes spoken" value={`${recap.minutes}`} glow="var(--glow-sky)" />
        <StatTile label="Words produced" value={`${recap.words_produced}`} glow="var(--glow-mint)" />
        <StatTile label="New words" value={`${recap.new_words.length}`} glow="var(--glow-lilac)" />
        <StatTile
          label="Fluency"
          value={recap.fluency_score === null ? "–" : `${recap.fluency_score}`}
          sub="out of 100"
          glow="var(--glow-rose)"
        />
      </section>

      <section className="mt-7" aria-label="Notes">
        <h2 className="mb-3 text-[12px] text-ink-muted">
          Notes · {recap.notes.length === 0 ? "none" : recap.notes.length}
        </h2>
        {recap.notes.length === 0 ? (
          <GlassCard>
            <p className="text-[14px] text-ink-muted">Clean run. Nothing to fix this time.</p>
          </GlassCard>
        ) : (
          <ol className="space-y-3">
            {recap.notes.map((n) => (
              <li key={`${n.you_said}-${n.grammar_tag}`}>
                <GlassCard>
                  <p className="text-[13px] text-ink-muted line-through decoration-ink/30" lang="de">
                    {n.you_said}
                  </p>
                  <p className="mt-1 text-[16px] font-medium" lang="de">
                    {n.native_would_say}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">{n.why}</p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="rounded-pill bg-ink/8 px-2 py-0.5 text-[11px]">
                      {n.grammar_tag.replaceAll("_", " ")}
                    </span>
                    {n.times > 1 && (
                      <span className="rounded-pill bg-ink/8 px-2 py-0.5 text-[11px]">×{n.times}</span>
                    )}
                  </div>
                </GlassCard>
              </li>
            ))}
          </ol>
        )}
      </section>

      {recap.positives.length > 0 && (
        <section className="mt-6" aria-label="You handled well">
          <h2 className="mb-3 text-[12px] text-ink-muted">You handled well</h2>
          <GlassCard>
            <ul className="space-y-2">
              {recap.positives.map((p) => (
                <li key={p} className="text-[15px] leading-relaxed">
                  {p}
                </li>
              ))}
            </ul>
          </GlassCard>
        </section>
      )}

      {recap.next_step && (
        <section className="mt-6" aria-label="Next time">
          <h2 className="mb-3 text-[12px] text-ink-muted">Next time, let&apos;s try…</h2>
          <GlassCard>
            <p className="text-[15px] leading-relaxed">{recap.next_step}</p>
          </GlassCard>
        </section>
      )}

      {recap.new_words.length > 0 && (
        <section className="mt-6" aria-label="New words">
          <h2 className="mb-3 text-[12px] text-ink-muted">New words</h2>
          <GlassCard>
            <ul className="space-y-1.5">
              {recap.new_words.map((w) => (
                <li key={w.word} className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span lang="de">{w.word}</span>
                  <span className="text-right text-[13px] text-ink-muted">{w.gloss_en}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </section>
      )}

      <div className="mt-8 flex gap-2">
        <Pill
          className="flex-1"
          onClick={() => void saveWords()}
          disabled={recap.new_words.length === 0 || saveState !== "idle"}
        >
          {saveState === "saved"
            ? "Saved ✓"
            : saveState === "saving"
              ? "Saving…"
              : `Save ${recap.new_words.length} new words`}
        </Pill>
        <PillLink href="/talk" variant="glass">
          Talk again
        </PillLink>
      </div>
      {error && <p className="mt-3 text-[13px] text-[#C2415F]">{error}</p>}
    </main>
  );
}
