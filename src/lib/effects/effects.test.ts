import { describe, expect, it } from "vitest";

import {
  Effect,
  effectFromKey,
  effectKey,
  sameEffect,
  STILLS,
} from "./effects";

describe("effect keys", () => {
  it("round-trips every kind of choice", () => {
    const choices: Effect[] = [
      { kind: "blur", level: "slight" },
      { kind: "blur", level: "strong" },
      { kind: "still", id: "great-wave" },
      { kind: "motion", id: "aurora" },
      { kind: "upload", id: "a1b2c3" },
    ];
    for (const choice of choices) {
      expect(effectFromKey(effectKey(choice))).toEqual(choice);
    }
  });

  it("treats none and anything unknown as no effect", () => {
    expect(effectKey(null)).toBe("none");
    expect(effectFromKey("none")).toBeNull();
    expect(effectFromKey("blur:extreme")).toBeNull();
    expect(effectFromKey("still:not-a-background")).toBeNull();
    expect(effectFromKey("upload:../../etc")).toBeNull();
  });

  it("compares choices", () => {
    expect(
      sameEffect(
        { kind: "motion", id: "waves" },
        { kind: "motion", id: "waves" },
      ),
    ).toBe(true);
    expect(sameEffect({ kind: "blur", level: "slight" }, null)).toBe(false);
    expect(sameEffect(null, null)).toBe(true);
  });
});

describe("the default backgrounds", () => {
  it("has four in each group, with unique IDs", () => {
    const ids = STILLS.map((still) => still.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of ["art", "places", "abstract"]) {
      expect(STILLS.filter((still) => still.group === group)).toHaveLength(4);
    }
  });

  it("validates stored choices", () => {
    expect(Effect.safeParse({ kind: "still", id: "oxbow" }).success).toBe(true);
    expect(Effect.safeParse({ kind: "still", id: "nope" }).success).toBe(false);
    expect(Effect.safeParse({ kind: "blur" }).success).toBe(false);
  });
});
