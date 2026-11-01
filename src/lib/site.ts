import { publicEnv } from "@/lib/env";

/**
 * The site's canonical origin, for sitemaps, robots.txt, llms.txt and metadata:
 * NEXT_PUBLIC_APP_URL first, then Vercel's production domain, then local development.
 */
export function siteUrl(): string {
  if (publicEnv.NEXT_PUBLIC_APP_URL)
    return publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/** Public pages crawlers and agents may index. Private pages are listed in PRIVATE_PATHS. */
export const PUBLIC_PATHS = ["/"] as const;

/**
 * App and meeting pages: never indexed. Meeting links (/j/...) are private by nature,
 * and the dashboard needs an account.
 */
export const PRIVATE_PATHS = [
  "/api/",
  "/j/",
  "/join",
  "/sign-in",
  "/home",
  "/upcoming",
  "/previous",
  "/personal-room",
  "/schedule",
  "/meetings/",
  "/settings",
  "/admin",
] as const;
