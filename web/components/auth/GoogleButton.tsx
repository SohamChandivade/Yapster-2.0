"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type State = "loading" | "hidden" | "ready" | "elsewhere";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * Shown only when the API has Google credentials and this page is served from the
 * origin Google will send the browser back to. On the phone over the hotspot that is
 * not the case, so a short note replaces the button.
 */
export function GoogleButton({
  className,
  label = "Continue with Google",
}: {
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .providers()
      .then((p) => {
        if (cancelled) return;
        if (!p.google.enabled) setState("hidden");
        else setState(window.location.origin === p.google.web_origin ? "ready" : "elsewhere");
      })
      .catch(() => {
        if (!cancelled) setState("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading" || state === "hidden") return null;

  if (state === "elsewhere") {
    return (
      <p className={cn("text-center text-[12px] leading-relaxed text-ink-muted", className)}>
        Google sign-in works from the laptop for now. On your phone, use email.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.location.assign(api.googleStartUrl())}
      className={cn(
        "glass-strong flex h-14 w-full items-center justify-center gap-3 rounded-pill text-[16px] font-medium text-ink",
        "transition-transform duration-200 ease-out active:scale-[0.98]",
        className,
      )}
    >
      <GoogleMark className="h-5 w-5" />
      {label}
    </button>
  );
}
