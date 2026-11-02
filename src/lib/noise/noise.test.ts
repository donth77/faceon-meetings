import { describe, expect, it } from "vitest";

import {
  browserSuppression,
  effectiveNoiseSuppression,
  parseNoiseSuppression,
} from "./noise";

describe("parseNoiseSuppression", () => {
  it("reads each choice", () => {
    expect(parseNoiseSuppression("off")).toBe("off");
    expect(parseNoiseSuppression("standard")).toBe("standard");
    expect(parseNoiseSuppression("strong")).toBe("strong");
  });

  it("keeps the earlier switch's off, and lets its on follow the default", () => {
    expect(parseNoiseSuppression(false)).toBe("off");
    expect(parseNoiseSuppression(true)).toBeUndefined();
  });

  it("ignores anything else", () => {
    expect(parseNoiseSuppression("loud")).toBeUndefined();
    expect(parseNoiseSuppression(null)).toBeUndefined();
    expect(parseNoiseSuppression(undefined)).toBeUndefined();
  });
});

describe("effectiveNoiseSuppression", () => {
  it("runs strong where the browser can", () => {
    expect(effectiveNoiseSuppression("strong", true)).toBe("strong");
  });

  it("falls back to standard where it can't", () => {
    expect(effectiveNoiseSuppression("strong", false)).toBe("standard");
  });

  it("leaves off and standard alone", () => {
    expect(effectiveNoiseSuppression("off", false)).toBe("off");
    expect(effectiveNoiseSuppression("standard", false)).toBe("standard");
  });
});

describe("browserSuppression", () => {
  it("asks the browser only for standard", () => {
    expect(browserSuppression("standard")).toBe(true);
    expect(browserSuppression("strong")).toBe(false);
    expect(browserSuppression("off")).toBe(false);
  });
});
