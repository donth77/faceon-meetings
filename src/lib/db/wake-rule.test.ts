import { describe, expect, it } from "vitest";

import { isNeonDatabase, shouldWakeDatabase } from "./wake-rule";

const NEON =
  "postgresql://user:secret@ep-quiet-sound-a1b2c3d4-pooler.us-east-1.aws.neon.tech/app?sslmode=require";
const OTHER = "postgresql://user:secret@db.example.com:5432/app";

describe("isNeonDatabase", () => {
  it("recognizes Neon's hosts, pooled or direct", () => {
    expect(isNeonDatabase(NEON)).toBe(true);
    expect(isNeonDatabase(NEON.replace("-pooler", ""))).toBe(true);
  });

  it("says no to other hosts, look-alikes and nonsense", () => {
    expect(isNeonDatabase(OTHER)).toBe(false);
    expect(isNeonDatabase("postgresql://u:p@neon.tech.example.com/app")).toBe(
      false,
    );
    expect(isNeonDatabase("postgresql://u:p@notneon.tech/app")).toBe(false);
    expect(isNeonDatabase("not a url")).toBe(false);
    expect(isNeonDatabase(undefined)).toBe(false);
  });
});

describe("shouldWakeDatabase", () => {
  it("wakes Neon on auto, and nothing else", () => {
    expect(shouldWakeDatabase("auto", NEON)).toBe(true);
    expect(shouldWakeDatabase("auto", OTHER)).toBe(false);
    expect(shouldWakeDatabase("auto", undefined)).toBe(false);
  });

  it("lets the setting decide outright", () => {
    expect(shouldWakeDatabase("off", NEON)).toBe(false);
    expect(shouldWakeDatabase("on", OTHER)).toBe(true);
  });
});
