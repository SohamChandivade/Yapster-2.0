"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { Pill } from "@/components/ui/Pill";
import { api, ApiError } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { GoogleButton } from "./GoogleButton";

type Mode = "login" | "register";

const copy: Record<
  Mode,
  { title: string; sub: string; cta: string; alt: string; altCta: string; altHref: string }
> = {
  register: {
    title: "Create your account",
    sub: "Google, or two fields. Then we talk.",
    cta: "Continue with email",
    alt: "Already have an account?",
    altCta: "Log in",
    altHref: "/login",
  },
  login: {
    title: "Welcome back",
    sub: "Lena kept your seat warm.",
    cta: "Log in",
    alt: "New here?",
    altCta: "Create an account",
    altHref: "/register",
  },
};

const EMAIL = /^\S+@\S+\.\S+$/;

const GOOGLE_REASONS: Record<string, string> = {
  access_denied: "You closed the Google window before finishing.",
  state_mismatch: "That sign-in link had expired. Please try again.",
  missing_state: "That sign-in link had expired. Please try again.",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[12px] text-ink-muted">{label}</span>
      <div className="glass-strong flex h-14 items-center gap-2 rounded-pill px-5 focus-within:ring-2 focus-within:ring-ink/15">
        {children}
      </div>
    </label>
  );
}

const inputClass =
  "min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted/60";

/** One screen for both sign-in flows: Google first, then two fields and one button. */
export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = copy[mode];
  const valid = EMAIL.test(email.trim()) && password.length >= (mode === "register" ? 8 : 1);

  // A failed Google round-trip lands here with ?error=google&reason=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "google") return;
    const reason = params.get("reason") ?? "";
    setError(GOOGLE_REASONS[reason] ?? `Google sign-in didn't complete (${reason || "unknown"}). Try again or use email.`);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "register"
          ? await api.register(email.trim(), password)
          : await api.login(email.trim(), password);
      startSession(res.token, res.user.onboarded);
      router.replace(res.user.onboarded ? "/" : "/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not reach the server. Is the API running?",
      );
      setBusy(false);
    }
  }

  return (
    <main
      className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
      }}
    >
      <Backdrop variant={mode === "login" ? "cool" : "warm"} />

      <header className="flex items-center">
        <Link href="/welcome" className="flex items-center gap-2" aria-label="Yapster home">
          <Blob size={32} expression="none" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Yapster</span>
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-8">
        <Blob
          size={110}
          expression={error ? "sad" : busy ? "thinking" : "happy"}
          palette={mode === "login" ? "cool" : "warm"}
          className="self-center"
        />
        <h1 className="mt-7 text-[34px] leading-[1.15] font-normal tracking-[-0.025em]">{c.title}</h1>
        <p className="mt-2 text-[14px] text-ink-muted">{c.sub}</p>

        <GoogleButton className="mt-6" />
        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-ink/10" />
          <span className="text-[12px] text-ink-muted">or</span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label="Email">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              type={show ? "text" : "password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="shrink-0 text-[13px] font-medium text-ink-muted"
              aria-pressed={show}
            >
              {show ? "Hide" : "Show"}
            </button>
          </Field>
          {error && (
            <p role="alert" className="px-1 text-[13px] text-[#C2415F]">
              {error}
            </p>
          )}
          <Pill type="submit" size="lg" className="w-full" disabled={!valid || busy}>
            {busy ? "One moment…" : c.cta}
          </Pill>
        </form>

        <p className="mt-5 text-center text-[13px] text-ink-muted">
          {c.alt}{" "}
          <Link href={c.altHref} className="font-medium text-ink">
            {c.altCta}
          </Link>
        </p>
      </section>
    </main>
  );
}
