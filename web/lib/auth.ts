/**
 * Client-side session. The API token and an "onboarded" flag live in cookies so
 * Next middleware can route without a round trip. The API sits on another origin,
 * so JavaScript has to read the token anyway; an httpOnly cookie would buy nothing.
 */

export const TOKEN_COOKIE = "yapster_token";
export const ONBOARDED_COOKIE = "yapster_onboarded";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches the API token lifetime

function read(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function write(name: string, value: string, maxAge: number): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function getToken(): string | null {
  return read(TOKEN_COOKIE);
}

export function isOnboarded(): boolean {
  return read(ONBOARDED_COOKIE) === "1";
}

export function startSession(token: string, onboarded: boolean): void {
  write(TOKEN_COOKIE, token, MAX_AGE);
  setOnboarded(onboarded);
}

export function setOnboarded(value: boolean): void {
  write(ONBOARDED_COOKIE, value ? "1" : "0", MAX_AGE);
}

export function clearSession(): void {
  write(TOKEN_COOKIE, "", 0);
  write(ONBOARDED_COOKIE, "", 0);
}
