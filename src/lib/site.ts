import { publicEnv } from "@/lib/env";

/**
 * The site's canonical origin, for sitemaps, robots.txt, llms.txt and metadata:
 * NEXT_PUBLIC_APP_URL first, then Vercel's production domain, then local development.
 */
export function siteUrl(): string {
  if (publicEnv.NEXT_PUBLIC_APP_URL) {
    return publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}
