import { describe, expect, it } from "vitest";

import { MOTIONS, STILLS } from "@/lib/effects/effects";

import { parseFrontMatter } from "./front-matter";
import {
  fillPlaceholders,
  readLegalSource,
  type LegalDocumentName,
  type Operator,
} from "./legal";

const DOCUMENTS: LegalDocumentName[] = ["privacy", "terms", "credits"];

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
        expect(fillPlaceholders(source, operator)).not.toMatch(/\{\w+\}/);
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
    expect(
      fillPlaceholders("{operator} runs {appName} at {siteUrl}.", named),
    ).toBe("Ana Lima runs FaceOn at faceon.example.");
  });

  it("says who runs a copy that hasn't named its operator", () => {
    expect(fillPlaceholders("{operator}", unnamed)).toBe("FaceOn's operator");
  });

  it("gives the email first, then the repo's issues", () => {
    expect(fillPlaceholders("{contact}", named)).toBe(
      "email [privacy@faceon.example](mailto:privacy@faceon.example).",
    );
    expect(fillPlaceholders("{contact}", { ...named, email: undefined })).toBe(
      "open an issue on [GitHub](https://github.com/faceon/faceon/issues).",
    );
    expect(fillPlaceholders("{contact}", unnamed)).toBe(
      "use the contact details on this site.",
    );
  });

  it("names the governing law only when the copy says whose it is", () => {
    expect(fillPlaceholders("{governingLaw}", named)).toBe(
      "the laws of the State of New York, USA",
    );
    expect(
      fillPlaceholders("{governingLaw}", { ...named, jurisdiction: undefined }),
    ).toBe("the laws of the place where Ana Lima is based");
    expect(fillPlaceholders("{governingLaw}", unnamed)).toBe(
      "the laws of the place where FaceOn's operator is based",
    );
  });
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
});
