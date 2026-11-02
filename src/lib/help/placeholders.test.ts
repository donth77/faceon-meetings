import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { fillHelpPlaceholders, type HelpLimits } from "./placeholders";

const defaults: HelpLimits = {
  demoMinutes: 15,
  demoPeople: 4,
  demoPerDay: 3,
  fullPeople: 20,
  fullMinutes: 0,
  meetingsPerDay: 20,
  aloneMinutes: 10,
};

describe("fillHelpPlaceholders", () => {
  it("fills every placeholder in every article", async () => {
    const folder = path.join(process.cwd(), "content", "help", "en");
    for (const file of await readdir(folder)) {
      const raw = await readFile(path.join(folder, file), "utf8");
      for (const limits of [
        defaults,
        { ...defaults, fullMinutes: 60, aloneMinutes: 0 },
      ]) {
        const filled = fillHelpPlaceholders(raw, {
          appName: "FaceOn",
          ...limits,
        });
        expect(filled, file).not.toMatch(/\{[a-zA-Z]+\}/);
      }
    }
  });

  it("says full meetings have no time limit when none is set", () => {
    const text = "Full meetings run {fullLength}.";
    expect(fillHelpPlaceholders(text, { appName: "FaceOn", ...defaults })).toBe(
      "Full meetings run with no time limit.",
    );
    expect(
      fillHelpPlaceholders(text, {
        appName: "FaceOn",
        ...defaults,
        fullMinutes: 90,
      }),
    ).toBe("Full meetings run for up to 90 minutes.");
  });

  it("explains the alone check, or that there's none", () => {
    expect(
      fillHelpPlaceholders("{aloneCheck}", {
        appName: "FaceOn",
        ...defaults,
        aloneMinutes: 0,
      }),
    ).toBe("FaceOn doesn’t end a meeting because you’re alone in it.");
  });
});
