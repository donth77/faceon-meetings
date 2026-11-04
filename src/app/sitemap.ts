import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { helpArticles } from "@/lib/help/articles";
import { PUBLIC_ROUTES } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

/**
 * Every public page and Help article, each with its address in every language (?hl=,
 * as the pages' own alternates give them), so search engines find each language's
 * version.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const articles = await helpArticles(routing.defaultLocale);
  const inLanguage = (path: string, language: string) =>
    `${origin}${path === "/" ? "" : path}${
      language === routing.defaultLocale ? "" : `?hl=${language}`
    }`;
  return [
    ...PUBLIC_ROUTES,
    ...articles.map((article) => `/help/${article.slug}`),
  ].map((path) => ({
    url: inLanguage(path, routing.defaultLocale),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((language) => [
          language,
          inLanguage(path, language),
        ]),
      ),
    },
  }));
}
