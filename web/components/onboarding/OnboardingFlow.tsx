"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob, type BlobExpression, type BlobPalette } from "@/components/ui/Blob";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowRightIcon, ChevronLeftIcon } from "@/components/ui/icons";
import { IconPill, Pill } from "@/components/ui/Pill";
import { api, ApiError, type OnboardingInput } from "@/lib/api";
import { setOnboarded } from "@/lib/auth";
import { cn } from "@/lib/cn";

type Comfort = OnboardingInput["comfort"];
type Level = "A0" | "A1" | "A2" | "B1" | "B2";
type Goal = "work" | "living" | "travel" | "exams" | "fun";

const COMFORT: { value: Comfort; label: string; expression: BlobExpression; palette: BlobPalette }[] = [
  { value: "terrifying", label: "Terrifying", expression: "sad", palette: "cool" },
  { value: "awkward", label: "Awkward", expression: "neutral", palette: "mint" },
  { value: "fine", label: "Fine", expression: "happy", palette: "warm" },
  { value: "pretty_good", label: "Pretty good", expression: "happy", palette: "rose" },
];

const LEVELS: { value: Level; label?: string; hint: string; wide?: boolean }[] = [
  { value: "A0", label: "Just starting", hint: "Hallo and Danke, that's about it. Lena keeps it tiny and you get hints.", wide: true },
  { value: "A1", hint: "Beginner. Hallo, danke, ein Bier." },
  { value: "A2", hint: "Basics. Simple sentences, present tense." },
  { value: "B1", hint: "Conversational. Gets by, with effort." },
  { value: "B2", hint: "Confident. Opinions, jokes, some slips." },
];

const GOALS: { value: Goal; label: string; scenario: string; scenarioTitle: string }[] = [
  { value: "work", label: "Work", scenario: "interview", scenarioTitle: "Job interview" },
  { value: "living", label: "Living in Germany", scenario: "landlord", scenarioTitle: "Landlord" },
  { value: "travel", label: "Travel", scenario: "train", scenarioTitle: "Train ticket" },
  { value: "exams", label: "Exams", scenario: "free", scenarioTitle: "Free talk" },
  { value: "fun", label: "Just because", scenario: "party", scenarioTitle: "Party small talk" },
];

const QUESTIONS = [
  "What should I call you?",
  "How does speaking German feel right now?",
  "What's your level?",
  "What do you need German for?",
  "Thanks for being honest.",
];
const STEPS = QUESTIONS.length;

const choice = (selected: boolean, extra = "") =>
  cn(
    "transition-colors duration-200",
    selected ? "bg-ink text-bg" : "glass-strong text-ink",
    extra,
  );

/** One question per screen; the Blob reacts to every answer (reference image 3). */
export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [comfort, setComfort] = useState<Comfort | null>(null);
  const [level, setLevel] = useState<Level | "unsure" | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLast = step === STEPS - 1;
  const canContinue = [name.trim().length > 0, comfort !== null, level !== null, goals.length > 0, true][step];
  const comfortMeta = COMFORT.find((c) => c.value === comfort);
  // "Not sure" starts low; the tutor drifts upward one notch when turns go easily.
  const effectiveLevel: Level = level === null || level === "unsure" ? "A1" : level;
  const firstGoal = GOALS.find((g) => g.value === goals[0]);

  const expression: BlobExpression = (() => {
    if (busy) return "thinking";
    if (error) return "sad";
    switch (step) {
      case 0:
        return name.trim() ? "happy" : "neutral";
      case 1:
        return comfortMeta?.expression ?? "neutral";
      case 2:
        return level === "unsure" ? "thinking" : level ? "happy" : "neutral";
      case 3:
        return goals.length ? "happy" : "neutral";
      default:
        return "happy";
    }
  })();
  const palette: BlobPalette = step === 1 ? (comfortMeta?.palette ?? "cool") : step === 2 ? "mint" : "warm";

  function go(delta: 1 | -1) {
    setDir(delta);
    setStep((s) => Math.max(0, Math.min(STEPS - 1, s + delta)));
  }

  function next() {
    if (!canContinue || busy) return;
    if (isLast) void finish();
    else go(1);
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api.onboarding({
        name: name.trim(),
        level: effectiveLevel,
        comfort: comfort ?? "awkward",
        goals,
        tutor_name: "Lena",
      });
      setOnboarded(true);
      router.replace(`/talk?scenario=${firstGoal?.scenario ?? "free"}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your answers. Try again.");
      setBusy(false);
    }
  }

  function toggleGoal(g: Goal) {
    setGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));
  }

  function onNameSubmit(e: FormEvent) {
    e.preventDefault();
    next();
  }

  const content = [
    <form key="name" onSubmit={onNameSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        aria-label="Your name"
        placeholder="Your name"
        autoComplete="given-name"
        enterKeyHint="next"
        className="glass-strong h-14 w-full rounded-pill px-5 text-center text-[18px] text-ink outline-none placeholder:text-ink-muted/60 focus:ring-2 focus:ring-ink/15"
      />
    </form>,

    <div key="comfort" className="space-y-2.5" role="group" aria-label="How speaking German feels">
      {COMFORT.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-pressed={comfort === c.value}
          onClick={() => setComfort(c.value)}
          className={choice(comfort === c.value, "h-14 w-full rounded-pill text-[16px] font-medium")}
        >
          {c.label}
        </button>
      ))}
    </div>,

    <div key="level">
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Your level">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            aria-pressed={level === l.value}
            onClick={() => setLevel(l.value)}
            className={choice(level === l.value, cn("rounded-card p-4 text-left", l.wide && "col-span-2"))}
          >
            <span className="block text-[22px] font-medium">{l.label ?? l.value}</span>
            <span className={cn("mt-1 block text-[12px] leading-snug", level === l.value ? "text-bg/70" : "text-ink-muted")}>
              {l.hint}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={level === "unsure"}
        onClick={() => setLevel("unsure")}
        className={cn(
          "mt-3 h-11 w-full rounded-pill text-[14px] font-medium transition-colors",
          level === "unsure" ? "bg-ink text-bg" : "text-ink-muted",
        )}
      >
        Not sure, let&apos;s find out
      </button>
    </div>,

    <div key="goals">
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="What you need German for">
        {GOALS.map((g) => (
          <button
            key={g.value}
            type="button"
            aria-pressed={goals.includes(g.value)}
            onClick={() => toggleGoal(g.value)}
            className={choice(goals.includes(g.value), "h-11 rounded-pill px-4 text-[14px] font-medium")}
          >
            {g.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-muted">Pick as many as you like.</p>
    </div>,

    <div key="summary">
      <GlassCard strong>
        <p className="text-[12px] text-ink-muted">Your plan</p>
        <p className="mt-2 text-[16px] leading-relaxed">
          Hallo, {name.trim()}. We&apos;ll start at <span className="font-semibold">{effectiveLevel}</span>
          {level === "unsure" ? " for now; the first chat will tell us more" : ""}. Short, everyday
          conversations pitched just above your level. Lena keeps notes while you talk and shows them
          after.
        </p>
        <p className="mt-3 text-[14px] text-ink-muted">
          First stop: <span className="text-ink">{firstGoal?.scenarioTitle ?? "Free talk"}</span>.
        </p>
      </GlassCard>
      {error && (
        <p role="alert" className="mt-3 px-1 text-[13px] text-[#C2415F]">
          {error}
        </p>
      )}
    </div>,
  ];

  return (
    <main
      className="relative mx-auto flex h-dvh max-w-[480px] flex-col px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
      }}
    >
      <Backdrop variant="cool" />

      <header className="flex h-11 shrink-0 items-center justify-between">
        {step > 0 ? (
          <IconPill aria-label="Back" onClick={() => go(-1)} disabled={busy}>
            <ChevronLeftIcon className="h-5 w-5" />
          </IconPill>
        ) : (
          <span className="h-11 w-11" aria-hidden />
        )}
        <span className="text-[12px] text-ink-muted">
          {step + 1} of {STEPS}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center">
        <div className="mt-3 shrink-0">
          <Blob size={140} expression={expression} palette={palette} speaking={isLast && !busy} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * 36 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="no-scrollbar mt-7 min-h-0 w-full flex-1 overflow-y-auto pb-2"
          >
            <h1 className="text-center text-[30px] leading-[1.15] font-light tracking-[-0.02em]">
              {QUESTIONS[step]}
            </h1>
            <div className="mt-6">{content[step]}</div>
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="flex shrink-0 items-center justify-between pt-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {QUESTIONS.map((q, i) => (
            <span
              key={q}
              className={cn(
                "h-1.5 rounded-pill transition-all duration-300",
                i === step ? "w-5 bg-ink" : "w-1.5 bg-ink/25",
              )}
            />
          ))}
        </div>
        {isLast ? (
          <Pill size="lg" onClick={next} disabled={busy}>
            {busy ? "Setting up…" : "Start talking"}
          </Pill>
        ) : (
          <button
            type="button"
            aria-label="Continue"
            onClick={next}
            disabled={!canContinue}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-25"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        )}
      </footer>
    </main>
  );
}
