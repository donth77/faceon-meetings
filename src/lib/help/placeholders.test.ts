import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator, type Locale } from "next-intl";
import { describe, expect, it } from "vitest";

import { parseFrontMatter } from "@/lib/content/front-matter";

import {
  fillHelpPlaceholders,
  type HelpLimits,
  type HelpPhrases,
} from "./placeholders";

const defaults: HelpLimits = {
  demoMinutes: 15,
  demoPeople: 4,
  demoPerDay: 3,
  fullPeople: 20,
  fullMinutes: 0,
  meetingsPerDay: 20,
  aloneMinutes: 10,
};

const folder = (...parts: string[]) =>
  path.join(process.cwd(), "content", "help", ...parts);
const articlesIn = (locale: string) =>
  readdirSync(folder(locale))
    .filter((file) => file.endsWith(".md"))
    .sort();

/** Every language Help is written in: content/help/<locale>/. */
const LANGUAGES = readdirSync(folder(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const TRANSLATED = LANGUAGES.filter((locale) => locale !== "en");

/** A language's sentences for the limits, from its messages (Help.fill). */
function phrasesIn(locale: string): HelpPhrases {
  const messages = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "messages", `${locale}.json`),
      "utf8",
    ),
  );
  const t = createTranslator({
    locale: locale as Locale,
    messages,
    namespace: "Help.fill",
  });
  return (phrase, values) => t(phrase, values);
}

const english = phrasesIn("en");

describe("fillHelpPlaceholders", () => {
  it.each(LANGUAGES)(
    "fills every placeholder in every %s article",
    (locale) => {
      const phrases = phrasesIn(locale);
      for (const file of articlesIn(locale)) {
        const raw = readFileSync(folder(locale, file), "utf8");
        for (const limits of [
          defaults,
          { ...defaults, fullMinutes: 60, aloneMinutes: 0 },
        ]) {
          const filled = fillHelpPlaceholders(
            raw,
            { appName: "FaceOn", ...limits },
            phrases,
          );
          expect(filled, `${locale} ${file}`).not.toMatch(/\{[a-zA-Z]+\}/);
        }
      }
    },
  );

  it("says full meetings have no time limit when none is set", () => {
    const text = "Full meetings run {fullLength}.";
    expect(
      fillHelpPlaceholders(text, { appName: "FaceOn", ...defaults }, english),
    ).toBe("Full meetings run with no time limit.");
    expect(
      fillHelpPlaceholders(
        text,
        { appName: "FaceOn", ...defaults, fullMinutes: 90 },
        english,
      ),
    ).toBe("Full meetings run for up to 90 minutes.");
  });

  it("explains the alone check, or that there's none", () => {
    expect(
      fillHelpPlaceholders(
        "{aloneCheck}",
        { appName: "FaceOn", ...defaults, aloneMinutes: 0 },
        english,
      ),
    ).toBe("FaceOn doesn’t end a meeting because you’re alone in it.");
    expect(
      fillHelpPlaceholders(
        "{aloneCheck}",
        { appName: "FaceOn", ...defaults },
        english,
      ),
    ).toContain("After 10 minutes alone in a meeting");
  });
});

describe.skipIf(TRANSLATED.length === 0)("translated articles", () => {
  const fieldsOf = (locale: string, file: string) =>
    parseFrontMatter(readFileSync(folder(locale, file), "utf8")).fields;

  it.each(TRANSLATED)("%s has every article, and only those", (locale) => {
    expect(articlesIn(locale)).toEqual(articlesIn("en"));
  });

  it.each(TRANSLATED)(
    "%s keeps each article's place, and has its title and summary",
    (locale) => {
      for (const file of articlesIn(locale)) {
        const fields = fieldsOf(locale, file);
        const source = fieldsOf("en", file);
        expect(fields.get("category"), `${locale} ${file}`).toBe(
          source.get("category"),
        );
        expect(fields.get("order"), `${locale} ${file}`).toBe(
          source.get("order"),
        );
        expect(fields.get("title"), `${locale} ${file}`).toBeTruthy();
        expect(fields.get("summary"), `${locale} ${file}`).toBeTruthy();
      }
    },
  );

  it.each(TRANSLATED)("%s links only to articles that exist", (locale) => {
    const slugs = new Set(articlesIn("en").map((file) => file.slice(0, -3)));
    for (const file of articlesIn(locale)) {
      const raw = readFileSync(folder(locale, file), "utf8");
      for (const [, slug] of raw.matchAll(/\]\(\/help\/([\w-]+)/g)) {
        expect(slugs, `${locale} ${file} → ${slug}`).toContain(slug);
      }
    }
  });
});
