import "server-only";

import { getTranslations } from "next-intl/server";

import { HELP_CATEGORIES, helpArticles, plainText } from "./articles";

/** What the browser needs about an article: enough to list it and search it. */
export type HelpEntry = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  /** The article's words, for search. */
  text: string;
};

export type HelpSection = { id: string; name: string; entries: HelpEntry[] };

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
