import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

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

const ROOT = path.join(process.cwd(), "content", "help");
const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;

function parse(slug: string, raw: string): HelpArticle {
  // Articles say {appName}; a self-hosted copy may go by another name.
  const text = raw
    .replace(/\r\n/g, "\n")
    .replaceAll("{appName}", publicEnv.NEXT_PUBLIC_APP_NAME);
  const match = FRONT_MATTER.exec(text);
  if (!match?.[1])
    throw new Error(`Help article "${slug}" has no front matter.`);
  const fields = new Map(
    match[1].split("\n").map((line) => {
      const colon = line.indexOf(":");
      return [
        line.slice(0, colon).trim(),
        line.slice(colon + 1).trim(),
      ] as const;
    }),
  );
  const category = CATEGORY_IDS[fields.get("category") ?? ""];
  if (!category)
    throw new Error(`Help article "${slug}" has an unknown category.`);
  return {
    slug,
    title: fields.get("title") ?? slug,
    summary: fields.get("summary") ?? "",
    category,
    order: Number(fields.get("order")) || 0,
    body: text.slice(match[0].length),
  };
}

/** The folder for a language's articles; English until a translation exists. */
async function folderFor(locale: string): Promise<string> {
  const own = path.join(ROOT, locale);
  try {
    if ((await readdir(own)).some((file) => file.endsWith(".md"))) return own;
  } catch {
    // No translation yet.
  }
  return path.join(ROOT, "en");
}

/** Every help article in a language, in reading order (by category, then order). */
export async function helpArticles(locale: string): Promise<HelpArticle[]> {
  "use cache";
  const folder = await folderFor(locale);
  const files = (await readdir(folder)).filter((file) => file.endsWith(".md"));
  const articles = await Promise.all(
    files.map(async (file) =>
      parse(file.slice(0, -3), await readFile(path.join(folder, file), "utf8")),
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
