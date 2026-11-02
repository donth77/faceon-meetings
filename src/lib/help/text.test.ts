import { describe, expect, it } from "vitest";

import { fold, foldWithOffsets, meaningfulWords, wordsIn } from "./text";

describe("fold", () => {
  it("sets case and accents aside", () => {
    expect(fold("Écran Partagé")).toBe("ecran partage");
    expect(fold("ÜBER")).toBe("uber");
  });
});

describe("foldWithOffsets", () => {
  it("says where each folded character came from", () => {
    const { folded, offsets } = foldWithOffsets("Café ok");
    expect(folded).toBe("cafe ok");
    expect(offsets).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps positions right when folding drops characters", () => {
    // "e" followed by a combining acute accent: two characters that fold to one.
    const { folded, offsets } = foldWithOffsets("Café ok");
    expect(folded).toBe("cafe ok");
    expect(offsets[4]).toBe(5);
    expect(offsets.at(-1)).toBe(8);
  });
});

describe("wordsIn", () => {
  it("splits on anything that isn't a letter or a digit", () => {
    expect(wordsIn("“Push-to-talk”, now!")).toEqual([
      "push",
      "to",
      "talk",
      "now",
    ]);
  });
});

describe("meaningfulWords", () => {
  it("leaves out words that join others, and repeats", () => {
    expect(meaningfulWords("How do I use push to talk? Talk!")).toEqual([
      "push",
      "talk",
    ]);
  });

  it("keeps two-letter words that mean something", () => {
    expect(meaningfulWords("AI notes")).toEqual(["ai", "notes"]);
  });

  it("drops single Latin letters, but not single characters of other scripts", () => {
    expect(meaningfulWords("a b mute")).toEqual(["mute"]);
    expect(meaningfulWords("音 声")).toEqual(["音", "声"]);
  });
});
