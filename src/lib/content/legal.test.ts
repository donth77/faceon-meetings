import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MOTIONS, STILLS } from "@/lib/effects/effects";

import { parseFrontMatter } from "./front-matter";
import {
  fillPlaceholders,
  readLegalSource,
  type LegalDocumentName,
  type LegalPhrase,
  type LegalPhrases,
  type Operator,
} from "./legal";

const DOCUMENTS: LegalDocumentName[] = ["privacy", "terms", "credits"];

/** The languages the documents are translated into: content/legal/<locale>/. */
const TRANSLATED = readdirSync(path.resolve("content/legal"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/** A language's placeholder phrases, from its messages (Legal.fill). */
function phrasesIn(locale: string): LegalPhrases {
  const messages = JSON.parse(
    readFileSync(path.resolve("messages", `${locale}.json`), "utf8"),
  ) as { Legal: { fill: Record<LegalPhrase, string> } };
  return (phrase, values = {}) =>
    messages.Legal.fill[phrase].replace(
      /\{(\w+)\}/g,
      (whole, name: string) => values[name] ?? whole,
    );
}

const english = phrasesIn("en");
const fill = (raw: string, operator: Operator) =>
  fillPlaceholders(raw, operator, english);

const named: Operator = {
  appName: "FaceOn",
  site: "faceon.example",
  name: "Ana Lima",
  email: "privacy@faceon.example",
  repoUrl: "https://github.com/faceon/faceon/",
  jurisdiction: "the State of New York, USA",
};

const unnamed: Operator = { appName: "FaceOn", site: "faceon.example" };

describe("the privacy policy, the terms and the credits", () => {
  it.each(DOCUMENTS)(
    "%s fills every placeholder, named or not",
    async (name) => {
      const source = await readLegalSource(name);
      for (const operator of [named, unnamed]) {
        expect(fill(source, operator)).not.toMatch(/\{\w+\}/);
      }
    },
  );

  it.each(DOCUMENTS)("%s has a title and the date it changed", async (name) => {
    const { fields } = parseFrontMatter(await readLegalSource(name));
    expect(fields.get("title")).toBeTruthy();
    expect(fields.get("updated")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("fillPlaceholders", () => {
  it("names the operator, the site and the app", () => {
    expect(fill("{operator} runs {appName} at {siteUrl}.", named)).toBe(
      "Ana Lima runs FaceOn at faceon.example.",
    );
  });

  it("says who runs a copy that hasn't named its operator", () => {
    expect(fill("{operator}", unnamed)).toBe("FaceOn's operator");
  });

  it("gives the email first, then the repo's issues", () => {
    expect(fill("{contact}", named)).toBe(
      "email [privacy@faceon.example](mailto:privacy@faceon.example).",
    );
    expect(fill("{contact}", { ...named, email: undefined })).toBe(
      "open an issue on [GitHub](https://github.com/faceon/faceon/issues).",
    );
    expect(fill("{contact}", unnamed)).toBe(
      "use the contact details on this site.",
    );
  });

  it("names the governing law only when the copy says whose it is", () => {
    expect(fill("{governingLaw}", named)).toBe(
      "the laws of the State of New York, USA",
    );
    expect(fill("{governingLaw}", { ...named, jurisdiction: undefined })).toBe(
      "the laws of the place where Ana Lima is based",
    );
    expect(fill("{governingLaw}", unnamed)).toBe(
      "the laws of the place where FaceOn's operator is based",
    );
  });
});

describe.skipIf(TRANSLATED.length === 0)("translations", () => {
  it.each(TRANSLATED)(
    "%s has every document, with the same placeholders, all filled",
    async (locale) => {
      const placeholders = (text: string) =>
        [...new Set(text.match(/\{\w+\}/g))].sort();
      for (const name of DOCUMENTS) {
        const source = await readLegalSource(name, locale);
        expect(placeholders(source), `${locale} ${name}`).toEqual(
          placeholders(await readLegalSource(name)),
        );
        const { fields } = parseFrontMatter(source);
        expect(fields.get("title"), `${locale} ${name}`).toBeTruthy();
        expect(fields.get("updated")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const operator of [named, unnamed]) {
          expect(
            fillPlaceholders(source, operator, phrasesIn(locale)),
          ).not.toMatch(/\{\w+\}/);
        }
      }
    },
  );
});

describe("the credits", () => {
  it("credit the avatars under their license, and every background's maker", async () => {
    const credits = await readLegalSource("credits");
    expect(credits).toContain("Natalia Spivak");
    expect(credits).toContain("CC BY 4.0");
    for (const background of [...STILLS, ...MOTIONS]) {
      if (background.license === "ours") continue;
      expect(credits).toContain(`by ${background.by}`);
    }
  });

  it("credit noise suppression's model and the code that runs it", async () => {
    const credits = await readLegalSource("credits");
    for (const name of [
      "RNNoise",
      "BSD 3-Clause",
      "Shiguredo",
      "web-noise-suppressor",
    ]) {
      expect(credits).toContain(name);
    }
  });
});
