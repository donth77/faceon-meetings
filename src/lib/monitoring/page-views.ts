import type { BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Page views as Vercel Web Analytics receives them (components/analytics), where this copy
 * counts them. Vercel's script sends three things that can describe a page: the address
 * it's handed (`beforeSend` below decides it), the route Next.js matched (`/j/[code]`,
 * from the page's params) and, on the first page of a visit, the address of another site
 * that linked to it (never one of this site's own).
 *
 * The address would carry meeting IDs and session IDs in paths, and tokens, passcodes and
 * email addresses in queries and fragments, so it becomes the page's route instead: no
 * query string or fragment, and each dynamic segment by its name. A path that isn't one
 * of FaceOn's pages counts as the not-found page's route, so a mistyped or pasted link
 * can't bring along what was typed into it.
 */

/** Where Vercel serves Web Analytics on the site itself: its script and its endpoints. */
export const INSIGHTS_PATH = "/_vercel/insights";

/**
 * Every page under src/app/[locale], as its route (without the locale or route groups),
 * with dynamic segments named as their folders are. A unit test checks it against the app.
 */
export const PAGE_ROUTES = [
  "/",
  "/[...rest]",
  "/admin",
  "/credits",
  "/desktop/calendar",
  "/desktop/sign-in",
  "/desktop/welcome",
  "/download",
  "/forgot-password",
  "/help",
  "/help/[slug]",
  "/home",
  "/j/[code]",
  "/meetings/[code]",
  "/meetings/[code]/edit",
  "/personal-room",
  "/previous",
  "/previous/[sessionId]/notes",
  "/privacy",
  "/reset-password",
  "/schedule",
  "/settings",
  "/settings/accessibility",
  "/settings/account",
  "/settings/admin",
  "/settings/ai-notes",
  "/settings/audio",
  "/settings/calendar",
  "/settings/desktop",
  "/settings/effects",
  "/settings/notifications",
  "/settings/reactions",
  "/settings/video",
  "/sign-in",
  "/sign-up",
  "/terms",
  "/unsubscribe",
  "/upcoming",
  "/verify-email",
] as const;

/** The not-found page's route, for any path that isn't a page. */
const NOT_FOUND = "/[...rest]";

/**
 * Help articles' names are public (content/help's file names), so their views are counted
 * by article: a name of lowercase words is kept, and anything else is still [slug].
 */
const KEPT: Partial<Record<string, RegExp>> = {
  "/help/[slug]": /^[a-z]+(?:-[a-z]+)*$/,
};

const segmentsOf = (path: string) => path.split("/").filter(Boolean);
const isDynamic = (segment: string) => segment.startsWith("[");
const isCatchAll = (segment: string) => segment.startsWith("[...");

/**
 * The routes with their segments, in Next.js's order of precedence: at the first segment
 * where two differ, a static one wins over a dynamic one, and a dynamic one over a
 * catch-all.
 */
const ROUTES = PAGE_ROUTES.map((route) => {
  const segments = segmentsOf(route);
  const rank = segments
    .map((segment) =>
      isCatchAll(segment) ? "0" : isDynamic(segment) ? "1" : "2",
    )
    .join("");
  return { route, segments, rank };
}).sort((a, b) => b.rank.localeCompare(a.rank));

function matches(route: readonly string[], path: readonly string[]): boolean {
  const last = route.at(-1);
  const catchAll = last !== undefined && isCatchAll(last);
  if (catchAll ? path.length < route.length : path.length !== route.length) {
    return false;
  }
  return route.every(
    (segment, index) => isDynamic(segment) || segment === path[index],
  );
}

/** The route of the page at `pathname`: /j/1234567890 → /j/[code]. */
export function pageRoute(pathname: string): string {
  const path = segmentsOf(pathname);
  const found = ROUTES.find(({ segments }) => matches(segments, path));
  if (!found) return NOT_FOUND;
  const kept = KEPT[found.route];
  if (!kept) return found.route;
  return `/${found.segments
    .map((segment, index) => {
      const actual = path[index] ?? "";
      return isDynamic(segment) && kept.test(actual) ? actual : segment;
    })
    .join("/")}`;
}

/**
 * Vercel's `beforeSend`: a page view with its address cut down to its route on this site
 * (https://faceon.example.com/j/[code]). FaceOn sends no events of its own, so anything
 * else, and an address that can't be read, is dropped.
 */
export function pageView(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview" || !URL.canParse(event.url)) return null;
  const url = new URL(event.url);
  return { ...event, url: `${url.origin}${pageRoute(url.pathname)}` };
}
