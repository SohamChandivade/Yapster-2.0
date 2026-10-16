"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob, type BlobExpression } from "@/components/ui/Blob";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { IconPill, Pill, PillLink } from "@/components/ui/Pill";
import { type TalkStatus, useTalkStore } from "@/lib/talkStore";
import { CorrectionsDrawer } from "./CorrectionsDrawer";
import { DifficultyPill } from "./DifficultyPill";
import { HelpMeSayThis } from "./HelpMeSayThis";
import { LeaveSheet } from "./LeaveSheet";
import { NotesChip } from "./NotesChip";
import { TalkBar } from "./TalkBar";
import { Transcript } from "./Transcript";

const expressionFor: Record<TalkStatus, BlobExpression> = {
  idle: "neutral",
  starting: "neutral",
  ready: "happy",
  thinking: "thinking",
  speaking: "happy",
  ending: "neutral",
  ended: "happy",
  failed: "sad",
};

/** The core screen (CLAUDE.md §5.3). Blob centred, transcript below, one glass pill at the bottom. */
export function TalkScreen({ scenario }: { scenario: string | null }) {
  const router = useRouter();
  const sessionId = useTalkStore((s) => s.sessionId);
  const status = useTalkStore((s) => s.status);
  const lines = useTalkStore((s) => s.lines);
  const level = useTalkStore((s) => s.level);
  const tutorName = useTalkStore((s) => s.tutorName);
  const scenarioTitle = useTalkStore((s) => s.scenarioTitle);
  const correctionCount = useTalkStore((s) => s.correctionCount);
  const corrections = useTalkStore((s) => s.corrections);
  const error = useTalkStore((s) => s.error);
  const { start, send, nudge, loadCorrections, end, discard, dismissError, reset } =
    useTalkStore.getState();

  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    void start(scenario);
    return () => reset();
  }, [scenario, start, reset]);

  const busy =
    status === "starting" || status === "thinking" || status === "speaking" || status === "ending";
  const saidSomething = lines.some((l) => l.role === "user");

  async function finish() {
    setLeaving(true);
    const id = await end();
    setLeaving(false);
    if (id) router.push(`/recap/${id}`);
  }

  async function leave() {
    setLeaving(true);
    await discard();
    router.push("/");
  }

  function back() {
    if (saidSomething && status !== "failed") setLeaveOpen(true);
    else void leave();
  }

  return (
    <main
      className="relative mx-auto flex h-dvh max-w-[480px] flex-col px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)",
      }}
    >
      <Backdrop />

      <header className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <IconPill aria-label="Back to dashboard" size={40} onClick={back} disabled={leaving}>
            <ChevronLeftIcon className="h-5 w-5" />
          </IconPill>
          <DifficultyPill level={level} disabled={!sessionId || busy} onNudge={(d) => void nudge(d)} />
        </div>
        <NotesChip
          count={correctionCount}
          onClick={() => {
            void loadCorrections();
            setNotesOpen(true);
          }}
        />
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center">
        <div className="mt-5 shrink-0">
          <Blob size={150} expression={expressionFor[status]} speaking={status === "speaking"} />
        </div>
        <p className="mt-3 shrink-0 text-[12px] text-ink-muted">
          {status === "starting" || status === "idle"
            ? "Connecting…"
            : `${tutorName} · ${scenarioTitle}`}
        </p>

        {status === "failed" ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <p className="max-w-[280px] text-[15px] leading-relaxed">{error}</p>
            <Pill variant="glass" className="mt-5" onClick={() => void start(scenario)}>
              Try again
            </Pill>
            <PillLink href="/" variant="ghost" size="sm" className="mt-2 text-ink-muted">
              Back to dashboard
            </PillLink>
          </div>
        ) : (
          <Transcript lines={lines} speaking={status === "speaking"} className="mt-5 min-h-0 flex-1" />
        )}

        {error && status !== "failed" && (
          <button
            type="button"
            onClick={dismissError}
            className="glass-strong mt-2 shrink-0 rounded-pill px-3 py-1.5 text-[12px] text-ink-muted"
          >
            {error} · tap to dismiss
          </button>
        )}
      </section>

      <div className="shrink-0 pt-3">
        <TalkBar
          disabled={status !== "ready"}
          busy={busy}
          onSend={(t) => void send(t)}
          onHelp={() => setHelpOpen(true)}
          onEnd={() => void finish()}
        />
      </div>

      <HelpMeSayThis
        open={helpOpen}
        sessionId={sessionId}
        onClose={() => setHelpOpen(false)}
        onUse={(german) => void send(german, true)}
      />
      <CorrectionsDrawer
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        corrections={corrections}
        tutorName={tutorName}
      />
      <LeaveSheet
        open={leaveOpen}
        busy={leaving}
        onClose={() => setLeaveOpen(false)}
        onRecap={() => {
          setLeaveOpen(false);
          void finish();
        }}
        onDiscard={() => {
          setLeaveOpen(false);
          void leave();
        }}
      />
    </main>
  );
}
