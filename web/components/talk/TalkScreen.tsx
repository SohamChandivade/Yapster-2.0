"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob, type BlobExpression } from "@/components/ui/Blob";
import { ChevronLeftIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/ui/icons";
import { IconPill, Pill, PillLink } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { speaker, useSpeakerStore } from "@/lib/speech/speaker";
import { useSpeechInput } from "@/lib/speech/useSpeechInput";
import { type TalkStatus, useTalkStore } from "@/lib/talkStore";
import { CorrectionsDrawer } from "./CorrectionsDrawer";
import { DifficultyPill } from "./DifficultyPill";
import { HelpMeSayThis } from "./HelpMeSayThis";
import { HintSheet } from "./HintSheet";
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
export function TalkScreen({ scenario, resumeId = null }: { scenario: string | null; resumeId?: string | null }) {
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
  const hints = useTalkStore((s) => s.hints);
  const hintLoading = useTalkStore((s) => s.hintLoading);
  const hintError = useTalkStore((s) => s.hintError);
  const showEnglish = useTalkStore((s) => s.showEnglish);
  const {
    start,
    resume,
    send,
    nudge,
    loadCorrections,
    loadHint,
    loadPrefs,
    setShowEnglish,
    end,
    discard,
    dismissError,
    reset,
  } = useTalkStore.getState();

  const voice = useSpeakerStore();
  const mic = useSpeechInput((text) => void send(text));

  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [hintLineId, setHintLineId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    speaker.init();
    loadPrefs();
    if (resumeId) void resume(resumeId);
    else void start(scenario);
    return () => reset();
  }, [scenario, resumeId, start, resume, reset, loadPrefs]);

  // Starting to talk interrupts Lena.
  useEffect(() => {
    if (mic.listening) speaker.cancel();
  }, [mic.listening]);

  const busy =
    status === "starting" || status === "thinking" || status === "speaking" || status === "ending";
  const saidSomething = lines.some((l) => l.role === "user");
  const blobSpeaking = voice.speaking || status === "speaking";
  const blobExpression: BlobExpression = mic.listening ? "neutral" : expressionFor[status];
  const hintLine = hintLineId ? lines.find((l) => l.id === hintLineId) : undefined;

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

  function openHint(lineId: string) {
    setHintLineId(lineId);
    void loadHint(lineId);
  }

  const notice = error ?? mic.error;
  const dismissNotice = error ? dismissError : mic.dismissError;

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
        <div className="flex items-center gap-2">
          {voice.available && (
            <IconPill
              size={40}
              aria-label={voice.enabled ? "Voice on" : "Voice off"}
              aria-pressed={voice.enabled}
              onClick={() => speaker.setEnabled(!voice.enabled)}
              className={cn(!voice.enabled && "text-ink-muted")}
            >
              {voice.enabled ? <SpeakerIcon className="h-5 w-5" /> : <SpeakerOffIcon className="h-5 w-5" />}
            </IconPill>
          )}
          <NotesChip
            count={correctionCount}
            onClick={() => {
              void loadCorrections();
              setNotesOpen(true);
            }}
          />
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center">
        <div className="relative mt-5 shrink-0">
          <AnimatePresence>
            {mic.listening && (
              <motion.span
                aria-hidden
                className="absolute -inset-3 rounded-full border-2 border-[#E8557E]/70"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: [0.8, 0.3, 0.8], scale: [1, 1.08, 1] }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </AnimatePresence>
          <Blob size={150} expression={blobExpression} speaking={blobSpeaking} />
        </div>
        <p className="mt-3 shrink-0 text-[12px] text-ink-muted">
          {status === "starting" || status === "idle"
            ? "Connecting…"
            : mic.listening
              ? "Listening…"
              : `${tutorName} · ${scenarioTitle}`}
        </p>

        {voice.needsTap && (
          <button
            type="button"
            onClick={speaker.tapToPlay}
            className="glass-strong mt-3 shrink-0 rounded-pill px-3.5 py-1.5 text-[12px] font-medium"
          >
            Tap to hear {tutorName || "Lena"}
          </button>
        )}

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
          <Transcript
            lines={lines}
            speaking={status === "speaking"}
            showEnglish={showEnglish}
            onHint={openHint}
            hintLoading={hintLoading !== null}
            hintsDisabled={busy}
            className="mt-5 min-h-0 flex-1"
          />
        )}

        {notice && status !== "failed" && (
          <button
            type="button"
            onClick={dismissNotice}
            className="glass-strong mt-2 shrink-0 rounded-pill px-3 py-1.5 text-[12px] text-ink-muted"
          >
            {notice} · tap to dismiss
          </button>
        )}
      </section>

      <div className="shrink-0 pt-3">
        <TalkBar
          disabled={status !== "ready"}
          busy={busy}
          mic={mic}
          onSend={(t) => void send(t)}
          onHelp={() => setHelpOpen(true)}
          onEnd={() => void finish()}
        />
      </div>

      <HintSheet
        open={hintLineId !== null}
        onClose={() => setHintLineId(null)}
        tutorName={tutorName}
        tutorLine={hintLine?.text ?? ""}
        hint={hintLineId ? (hints[hintLineId] ?? null) : null}
        loading={hintLoading !== null}
        error={hintError}
        onRetry={() => hintLineId && void loadHint(hintLineId)}
        canListen={voice.available}
        showEnglish={showEnglish}
        onToggleEnglish={setShowEnglish}
        onListen={(german) => speaker.preview(german)}
        onUse={(german) => {
          setHintLineId(null);
          void send(german, true);
        }}
      />
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
