/** Tiny class-name joiner. Keeps us free of clsx/tailwind-merge for now. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
