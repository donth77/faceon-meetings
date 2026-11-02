import "server-only";

import { getTranslations } from "next-intl/server";

import type { HelpSection } from "@/components/help/help-center";

import { HELP_CATEGORIES, helpArticles, plainText } from "./articles";

/** The articles grouped by category, named in the reader's language. */
export async function helpSections(
  locale: string,
  { withText }: { withText: boolean },
): Promise<HelpSection[]> {
  const [articles, t] = await Promise.all([
    helpArticles(locale),
    getTranslations("Help"),
  ]);
  return HELP_CATEGORIES.map((id) => ({
    id,
    name: t(`categories.${id}`),
    entries: articles
      .filter((article) => article.category === id)
      .map((article) => ({
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        category: id,
        // Only the search on Help's front page needs the words.
        text: withText ? plainText(article.body) : "",
      })),
  })).filter((section) => section.entries.length > 0);
}
