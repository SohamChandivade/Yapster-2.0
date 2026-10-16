"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Add to Home Screen" for the Profile screen. Chrome and Android hand us an install prompt;
 * iOS has no API, so it gets the two-tap instruction; once installed the card just says so.
 */
export function InstallCard() {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
    setIos(/iphone|ipad|ipod/i.test(nav.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  if (installed) {
    return (
      <GlassCard strong>
        <p className="text-[15px] font-medium">On your home screen</p>
        <p className="mt-0.5 text-[12px] text-ink-muted">Yapster opens full screen, like an app.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard strong>
      <p className="text-[15px] font-medium">Add to Home Screen</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
        {ios
          ? "In Safari, tap Share, then “Add to Home Screen”. Yapster then opens full screen with its own icon."
          : prompt
            ? "Install Yapster for a full-screen app with its own icon."
            : "Open this page on your phone and use the browser menu, or install from the address bar on desktop Chrome."}
      </p>
      {prompt && (
        <Pill variant="glass" size="sm" className="mt-4" onClick={() => void install()}>
          Install
        </Pill>
      )}
    </GlassCard>
  );
}
