/**
 * Route groups: the single source for access control (proxy), robots.txt, the sitemap
 * and the noindex headers, so they can't drift apart.
 */

/** Public pages that search engines and agents may index. */
export const PUBLIC_ROUTES = ["/"] as const;

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

/** Everything that must stay out of search engines and AI crawlers. */
export const NOINDEX_ROUTES = [
  ...AUTH_ROUTES,
  VERIFY_EMAIL_ROUTE,
  ...APP_ROUTES,
  ...MEETING_ROUTES,
] as const;

export const HOME_ROUTE = "/home";
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
