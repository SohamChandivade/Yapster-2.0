import { type NextRequest, NextResponse } from "next/server";

/**
 * Route guard driven by two cookies set on the client after sign-in:
 * signed-out visitors see only the public pages; signed-in users who have not
 * finished onboarding are held there; everyone else gets the app.
 *
 * The matcher is deliberately plain (Next mis-parsed a lookahead pattern here);
 * internals and static files are skipped in code instead.
 */
const PUBLIC = new Set(["/welcome", "/login", "/register"]);
// Always served: the OAuth hand-off must be able to set a fresh session, and the service
// worker precaches the offline page before anyone is necessarily signed in.
const ALWAYS = new Set(["/auth/callback", "/offline"]);
const TOKEN_COOKIE = "yapster_token";
const ONBOARDED_COOKIE = "yapster_onboarded";

function isAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/") || pathname === "/favicon.ico" || /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isAsset(pathname) || ALWAYS.has(pathname)) return NextResponse.next();

  const signedIn = Boolean(req.cookies.get(TOKEN_COOKIE)?.value);
  const onboarded = req.cookies.get(ONBOARDED_COOKIE)?.value === "1";
  const isPublic = PUBLIC.has(pathname);
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (!signedIn) return isPublic ? NextResponse.next() : go("/welcome");
  if (isPublic) return go(onboarded ? "/" : "/onboarding");
  if (!onboarded && pathname !== "/onboarding") return go("/onboarding");
  if (onboarded && pathname === "/onboarding") return go("/");
  return NextResponse.next();
}

export const config = { matcher: ["/:path*"] };
