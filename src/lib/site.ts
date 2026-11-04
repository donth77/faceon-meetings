import type { Metadata } from "next";

import { routing } from "@/i18n/routing";
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

/**
 * A public page's address in each language, for search engines: ?hl= picks a language
 * for that page (proxy.ts), and English, the default, is the plain address, which also
 * stands for every language FaceOn doesn't speak.
 */
export function languageAlternates(
  path: string,
  locale: string,
): NonNullable<Metadata["alternates"]> {
  const inLanguage = (language: string) =>
    language === routing.defaultLocale ? path : `${path}?hl=${language}`;
  return {
    canonical: inLanguage(locale),
    languages: {
      ...Object.fromEntries(
        routing.locales.map((language) => [language, inLanguage(language)]),
      ),
      "x-default": path,
    },
  };
}
