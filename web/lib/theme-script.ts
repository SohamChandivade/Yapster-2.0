/**
 * Hook-free theme constants and the inline init script.
 * Imported by the server layout; lib/theme.ts (client hook) builds on it.
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "yapster-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Inlined in <head> so the stored theme applies before first paint (no flash).
 * Mirrors readChoice() + resolveTheme() in lib/theme.ts; keep them in sync.
 */
export const themeInitScript = `(function(){try{var c=localStorage.getItem("${THEME_KEY}");var d=c==="dark"||(c==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;
