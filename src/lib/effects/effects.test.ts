import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  Effect,
  effectFromKey,
  effectKey,
  motionFile,
  MOTIONS,
  motionThumb,
  runnableEffect,
  sameEffect,
  stillFile,
  STILLS,
  stillThumb,
} from "./effects";

describe("effect keys", () => {
  it("round-trips every kind of choice", () => {
    const choices: Effect[] = [
      { kind: "blur", level: "slight" },
      { kind: "blur", level: "strong" },
      { kind: "still", id: "great-wave" },
      { kind: "motion", id: "aurora" },
      { kind: "motion", id: "orbit" },
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

  it("drops motion backgrounds that are no longer offered", () => {
    for (const retired of ["waves", "bokeh", "drift"]) {
      expect(effectFromKey(`motion:${retired}`)).toBeNull();
      expect(Effect.safeParse({ kind: "motion", id: retired }).success).toBe(
        false,
      );
    }
  });

  it("compares choices", () => {
    expect(
      sameEffect(
        { kind: "motion", id: "lake" },
        { kind: "motion", id: "lake" },
      ),
    ).toBe(true);
    expect(sameEffect({ kind: "blur", level: "slight" }, null)).toBe(false);
    expect(sameEffect(null, null)).toBe(true);
  });
});

describe("the default backgrounds", () => {
  it("has four stills in each group, with unique IDs", () => {
    const ids = STILLS.map((still) => still.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of ["art", "places", "abstract"]) {
      expect(STILLS.filter((still) => still.group === group)).toHaveLength(4);
    }
  });

  it("has motion backgrounds with unique IDs, as MP4 with a WebP thumbnail", () => {
    const ids = MOTIONS.map((motion) => motion.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(motionFile("lake")).toBe("/backgrounds/motion/lake.mp4");
    expect(motionThumb("lake")).toBe("/backgrounds/motion/lake.webp");
  });

  it("has every file it points to", () => {
    const files = [
      ...STILLS.flatMap((still) => [stillFile(still.id), stillThumb(still.id)]),
      ...MOTIONS.flatMap((motion) => [
        motionFile(motion.id),
        motionThumb(motion.id),
      ]),
    ];
    const missing = files.filter(
      (file) => !existsSync(path.join(process.cwd(), "public", file)),
    );
    expect(missing).toEqual([]);
  });

  it("validates stored choices", () => {
    expect(Effect.safeParse({ kind: "still", id: "oxbow" }).success).toBe(true);
    expect(Effect.safeParse({ kind: "still", id: "nope" }).success).toBe(false);
    expect(Effect.safeParse({ kind: "blur" }).success).toBe(false);
  });
});

describe("runnable effects", () => {
  const everything = { effects: true, footage: true };
  const lake: Effect = { kind: "motion", id: "lake" };
  const blur: Effect = { kind: "blur", level: "strong" };

  it("keeps an effect the device can run", () => {
    expect(runnableEffect(lake, everything)).toEqual(lake);
    expect(runnableEffect(blur, everything)).toEqual(blur);
  });

  it("drops every effect where the engine can't run", () => {
    expect(runnableEffect(blur, { effects: false, footage: true })).toBeNull();
    expect(runnableEffect(lake, { effects: false, footage: true })).toBeNull();
  });

  it("drops only motion where the browser can't play the footage", () => {
    const noFootage = { effects: true, footage: false };
    expect(runnableEffect(lake, noFootage)).toBeNull();
    expect(runnableEffect(blur, noFootage)).toEqual(blur);
    expect(runnableEffect({ kind: "still", id: "coast" }, noFootage)).toEqual({
      kind: "still",
      id: "coast",
    });
  });

  it("keeps no effect as no effect", () => {
    expect(runnableEffect(null, everything)).toBeNull();
  });
});
