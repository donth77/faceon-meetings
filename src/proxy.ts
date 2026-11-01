import { getSessionCookie } from "better-auth/cookies";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import {
  APP_ROUTES,
  AUTH_ROUTES,
  HOME_ROUTE,
  matchesRoute,
  SIGN_IN_ROUTE,
} from "./lib/routes";

const handleI18n = createMiddleware(routing);

/**
 * Runs before every page. First an optimistic access check from the session cookie
 * (pages still verify the session on the server), then language selection.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = getSessionCookie(request) !== null;

  if (!signedIn && matchesRoute(pathname, APP_ROUTES)) {
    const signIn = new URL(SIGN_IN_ROUTE, request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (signedIn && (pathname === "/" || matchesRoute(pathname, AUTH_ROUTES))) {
    return NextResponse.redirect(new URL(HOME_ROUTE, request.url));
  }

  return handleI18n(request);
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
