/**
 * Route groups: the single source for access control (proxy), robots.txt, the sitemap
 * and the noindex headers, so they can't drift apart.
 */

/** Public pages that search engines and agents may index (the sitemap adds Help articles). */
export const PUBLIC_ROUTES = [
  "/",
  "/help",
  "/download",
  "/privacy",
  "/terms",
  "/credits",
] as const;

/** Signing in, signing up and resetting a password. Signed-in visitors are sent on to HOME_ROUTE. */
export const AUTH_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
] as const;

/** Where an email verification link lands; signed in or not. */
export const VERIFY_EMAIL_ROUTE = "/verify-email";

/** Pages that need an account. Signed-out visitors are sent to sign-in. */
export const APP_ROUTES = [
  "/home",
  "/upcoming",
  "/previous",
  "/personal-room",
  "/schedule",
  "/meetings",
  "/settings",
  "/admin",
] as const;

/** Joining meetings: open to anyone with the link, but never indexed. */
export const MEETING_ROUTES = ["/j", "/join"] as const;

/** The desktop app's pages in the browser (signing it in). */
export const DESKTOP_ROUTES = ["/desktop"] as const;

/** The desktop app's first screen, signed out (it opens here). */
export const DESKTOP_WELCOME_ROUTE = "/desktop/welcome";

/** Where a reminder email's "Stop reminder emails" link lands; signed in or not. */
export const UNSUBSCRIBE_ROUTE = "/unsubscribe";

/** Everything that must stay out of search engines and AI crawlers. */
export const NOINDEX_ROUTES = [
  ...AUTH_ROUTES,
  ...DESKTOP_ROUTES,
  VERIFY_EMAIL_ROUTE,
  UNSUBSCRIBE_ROUTE,
  ...APP_ROUTES,
  ...MEETING_ROUTES,
] as const;

export const HOME_ROUTE = "/home";
export const PERSONAL_ROOM_ROUTE = "/personal-room";
export const SIGN_IN_ROUTE = "/sign-in";

/** True when `pathname` is one of `routes` or below one ("/settings" matches "/settings/audio"). */
export function matchesRoute(
  pathname: string,
  routes: readonly string[],
): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Where to go after signing in. Only same-site paths are allowed (no "//host" or
 * absolute URLs), so a crafted ?next= can't send people to another site.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return HOME_ROUTE;
  }
  return next;
}

/**
 * A meeting's join link: /j/<code>, with the passcode in the fragment (#pwd=…), which
 * browsers never send to the server.
 */
export const meetingPath = (code: string, passcode?: string | null) =>
  `/j/${code}${passcode ? `#pwd=${passcode}` : ""}`;

/** Editing a meeting; for a repeating one, the occurrence chosen (its original start). */
export const editMeetingPath = (code: string, occurrence?: string | null) =>
  `/meetings/${code}/edit${occurrence ? `?occurrence=${encodeURIComponent(occurrence)}` : ""}`;

/** A Help article; with the search that found it, which the article highlights (?q=). */
export const helpArticlePath = (slug: string, query?: string | null) => {
  const searched = query?.trim();
  return `/help/${slug}${searched ? `?q=${encodeURIComponent(searched)}` : ""}`;
};

/** Sign in, then come back to `next`. */
export const signInPath = (next: string) =>
  `${SIGN_IN_ROUTE}?next=${encodeURIComponent(next)}`;
