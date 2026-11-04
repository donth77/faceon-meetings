import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { safeRedirectPath, signInPath } from "@/lib/routes";

/** Better Auth's cookies, as the browser sends them: `__Secure-` where the site is https. */
const AUTH_COOKIE = /^(__Secure-)?better-auth\./;

/**
 * Where a page sends someone whose sign-in cookie no longer has a session (signed out of
 * other devices, say, or after a password reset): the cookie goes, then sign-in, which
 * the proxy would otherwise turn back from as long as it saw the cookie. A session
 * that's still good just goes back to where it was going.
 */
export async function GET(request: NextRequest) {
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (session) return NextResponse.redirect(new URL(next, request.url));

  const response = NextResponse.redirect(
    new URL(signInPath(next), request.url),
  );
  for (const { name } of request.cookies.getAll()) {
    if (!AUTH_COOKIE.test(name)) continue;
    // As Better Auth sets them, or the browser keeps them (a __Secure- cookie needs Secure).
    response.cookies.set(name, "", {
      path: "/",
      secure: name.startsWith("__Secure-"),
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
    });
  }
  return response;
}
