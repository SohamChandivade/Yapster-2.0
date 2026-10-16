"use client";

import { Backdrop } from "@/components/ui/Backdrop";
import { Blob } from "@/components/ui/Blob";
import { Pill } from "@/components/ui/Pill";

/** Served by the service worker when a navigation fails with no network. */
export function OfflineScreen() {
  return (
    <main
      className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Backdrop />
      <Blob size={128} palette="warm" expression="neutral" />
      <h1 className="mt-8 text-[32px] leading-[1.15] font-light tracking-[-0.025em]">You&rsquo;re offline</h1>
      <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-ink-muted">
        Lena needs a connection to talk. Everything you have said so far is safe on the server.
      </p>
      <Pill className="mt-8" onClick={() => window.location.reload()}>
        Try again
      </Pill>
    </main>
  );
}
