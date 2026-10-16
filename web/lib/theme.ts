"use client";

import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_KEY, type ResolvedTheme, type ThemeChoice } from "./theme-script";

export type { ResolvedTheme, ThemeChoice } from "./theme-script";

const listeners = new Set<() => void>();

export function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") return choice;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = resolveTheme(choice);
}

export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode: the choice still applies for this page view */
  }
  applyTheme(choice);
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (readChoice() === "system") applyTheme("system");
    notify();
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", notify);
  };
}

const serverSnapshot = (): ThemeChoice => "light";

/** The stored appearance choice and a setter. Light is the default. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, readChoice, serverSnapshot);
  return [choice, setTheme];
}
