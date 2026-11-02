import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontMatter } from "@/lib/content/front-matter";
import { publicEnv } from "@/lib/env";

/** Help's categories, in the order the index and the sidebar show them. */
export const HELP_CATEGORIES = [
  "gettingStarted",
  "inAMeeting",
  "hosting",
  "account",
  "troubleshooting",
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number];

/** Category names as written in the articles' front matter. */
const CATEGORY_IDS: Record<string, HelpCategory> = {
  "getting-started": "gettingStarted",
  "in-a-meeting": "inAMeeting",
  hosting: "hosting",
  account: "account",
  troubleshooting: "troubleshooting",
};

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  order: number;
  /** The article in Markdown, without its front matter. */
  body: string;
};

/**
 * A file or folder under content/help. The path is written out in full each time, so
 * the build can tell exactly which files are read (and doesn't trace the whole project).
 */
const helpPath = (...parts: string[]) =>
  path.join(process.cwd(), "content", "help", ...parts);
function parse(slug: string, raw: string): HelpArticle {
  // Articles say {appName}; a self-hosted copy may go by another name.
  const { fields, body } = parseFrontMatter(
    raw.replaceAll("{appName}", publicEnv.NEXT_PUBLIC_APP_NAME),
  );
  const category = CATEGORY_IDS[fields.get("category") ?? ""];
  if (!category) {
    throw new Error(`Help article "${slug}" has an unknown category.`);
  }
  return {
    slug,
    title: fields.get("title") ?? slug,
    summary: fields.get("summary") ?? "",
    category,
    order: Number(fields.get("order")) || 0,
    body,
  };
}

/** The language whose articles to show; English until a translation exists. */
async function languageFor(locale: string): Promise<string> {
  try {
    const files = await readdir(helpPath(locale));
    if (files.some((file) => file.endsWith(".md"))) return locale;
  } catch {
    // No translation yet.
  }
  return "en";
}

/** Every help article in a language, in reading order (by category, then order). */
export async function helpArticles(locale: string): Promise<HelpArticle[]> {
  "use cache";
  const language = await languageFor(locale);
  const files = (await readdir(helpPath(language))).filter((file) =>
    file.endsWith(".md"),
  );
  const articles = await Promise.all(
    files.map(async (file) =>
      parse(
        file.slice(0, -3),
        await readFile(helpPath(language, file), "utf8"),
      ),
    ),
  );
  return articles.sort(
    (a, b) =>
      HELP_CATEGORIES.indexOf(a.category) -
        HELP_CATEGORIES.indexOf(b.category) || a.order - b.order,
  );
}

/** An article's words without Markdown, for search. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
