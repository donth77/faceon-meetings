import { getSessionCookie } from "better-auth/cookies";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE, matchLocale } from "./i18n/match";
import { routing } from "./i18n/routing";
import {
  APP_ROUTES,
  AUTH_ROUTES,
  DESKTOP_WELCOME_ROUTE,
  HOME_ROUTE,
  matchesRoute,
  SIGN_IN_ROUTE,
} from "./lib/routes";

const handleI18n = createMiddleware(routing);

/**
 * The request as next-intl's language selection should see it. The browser's languages
 * become the one FaceOn picks from them, the first it speaks with every regional variant
 * counting as its language (i18n/match.ts), which next-intl's own matching doesn't
 * always do. `?hl=` asks for a language for this page only: the links search engines
 * get to each language's version use it, and it neither reads nor changes the language
 * the visitor chose.
 */
function forLanguageSelection(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  const asked = request.nextUrl.searchParams.get("hl");
  if (hasLocale(routing.locales, asked)) {
    headers.set("accept-language", asked);
    const kept = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(
        (cookie) => cookie !== "" && !cookie.startsWith(`${LOCALE_COOKIE}=`),
      );
    if (kept.length > 0) headers.set("cookie", kept.join("; "));
    else headers.delete("cookie");
  } else {
    headers.set(
      "accept-language",
      matchLocale(
        request.headers.get("accept-language"),
        routing.locales,
        routing.defaultLocale,
      ),
    );
  }
  return new NextRequest(request, { headers });
}

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

  if (
    signedIn &&
    (pathname === "/" ||
      pathname === DESKTOP_WELCOME_ROUTE ||
      matchesRoute(pathname, AUTH_ROUTES))
  ) {
    return NextResponse.redirect(new URL(HOME_ROUTE, request.url));
  }

  return handleI18n(forLanguageSelection(request));
}

export const config = {
  // Everything except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
