import { describe, expect, it } from "vitest";

import {
  contrast,
  difference,
  fitToSrgb,
  luminance,
  oklchToRgb,
  parseHex,
  toHex,
  toOklch,
} from "./color.ts";

describe("hex colors", () => {
  it("round-trips", () => {
    for (const hex of ["#000000", "#ffffff", "#1f5eff", "#0b0f17", "#facc15"]) {
      expect(toHex(parseHex(hex))).toBe(hex);
    }
    expect(toHex(parseHex("#1F5EFF"))).toBe("#1f5eff");
  });

  it("refuses anything else", () => {
    for (const bad of ["1f5eff0", "#fff", "blue", "#12345g"]) {
      expect(() => parseHex(bad)).toThrow();
    }
  });
});

describe("OKLCH", () => {
  it("matches the CSS reference values", () => {
    const red = toOklch("#ff0000");
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    expect(toOklch("#ffffff").l).toBeCloseTo(1, 5);
    expect(toOklch("#ffffff").c).toBeCloseTo(0, 5);
    expect(toOklch("#000000").l).toBeCloseTo(0, 5);
  });

  it("round-trips every sRGB color it's given", () => {
    for (const hex of ["#1f5eff", "#4d7eff", "#e8eeff", "#0f766e", "#7499ff"]) {
      expect(fitToSrgb(toOklch(hex))).toBe(hex);
    }
  });

  it("gives up chroma, not lightness or hue, for colors sRGB can't show", () => {
    const wanted = { l: 0.85, c: 0.3, h: 264 };
    expect(Object.values(oklchToRgb(wanted)).some((v) => v < 0 || v > 1)).toBe(
      true,
    );
    const fitted = toOklch(fitToSrgb(wanted));
    expect(fitted.l).toBeCloseTo(0.85, 2);
    expect(fitted.h).toBeCloseTo(264, 0);
    expect(fitted.c).toBeLessThan(0.3);
  });

  it("measures how far apart two colors look", () => {
    expect(difference("#1f5eff", "#1f5eff")).toBe(0);
    expect(difference("#1f5eff", "#1f5fff")).toBeLessThan(0.01);
    expect(difference("#000000", "#ffffff")).toBeCloseTo(1, 3);
  });
});

describe("WCAG contrast", () => {
  it("runs from 1 to 21", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#1f5eff", "#1f5eff")).toBe(1);
    expect(contrast("#ffffff", "#000000")).toBe(contrast("#000000", "#ffffff"));
  });

  it("agrees with the known ratios", () => {
    // #767676 is the lightest grey with 4.5:1 on white; #777777 just misses.
    expect(contrast("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
    expect(contrast("#1f5eff", "#ffffff")).toBeCloseTo(5.12, 2);
    expect(luminance("#ffffff")).toBe(1);
  });
});
