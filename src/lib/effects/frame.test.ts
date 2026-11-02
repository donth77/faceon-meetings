import { describe, expect, it } from "vitest";

import { coverScale, FrameBudget, MaskSmoother, wideCrop } from "./frame";

describe("wideCrop", () => {
  it("takes the middle 16:9 of a tall picture", () => {
    expect(wideCrop({ width: 1000, height: 1000 }, 1920)).toEqual({
      sx: 0,
      sy: 218.75,
      sw: 1000,
      sh: 562.5,
      width: 1000,
      height: 563,
    });
  });

  it("takes the middle of a very wide picture and scales it down", () => {
    const crop = wideCrop({ width: 8000, height: 2000 }, 1920);
    expect(crop.sw).toBeCloseTo(3555.56, 1);
    expect(crop.sx).toBeCloseTo(2222.22, 1);
    expect(crop.sy).toBe(0);
    expect([crop.width, crop.height]).toEqual([1920, 1080]);
  });

  it("never enlarges a small picture", () => {
    const crop = wideCrop({ width: 320, height: 180 }, 1920);
    expect([crop.width, crop.height]).toEqual([320, 180]);
  });
});

describe("coverScale", () => {
  it("crops the sides of a wider background", () => {
    const [x, y] = coverScale(
      { width: 2000, height: 1000 },
      { width: 1600, height: 900 },
    );
    expect(x).toBeCloseTo(16 / 9 / 2);
    expect(y).toBe(1);
  });

  it("crops the top and bottom of a taller background", () => {
    const [x, y] = coverScale(
      { width: 1000, height: 1000 },
      { width: 1280, height: 720 },
    );
    expect(x).toBe(1);
    expect(y).toBeCloseTo(9 / 16);
  });

  it("shows all of a background with the frame's shape", () => {
    expect(
      coverScale({ width: 1920, height: 1080 }, { width: 1280, height: 720 }),
    ).toEqual([1, 1]);
  });
});

describe("MaskSmoother", () => {
  it("starts from the first mask", () => {
    const smoother = new MaskSmoother();
    expect([...smoother.update(Float32Array.from([0, 0.5, 1]))]).toEqual([
      0, 128, 255,
    ]);
  });

  it("eases toward each new mask", () => {
    const smoother = new MaskSmoother(0.5);
    smoother.update(Float32Array.from([0, 1]));
    expect([...smoother.update(Float32Array.from([1, 0]))]).toEqual([128, 128]);
    expect([...smoother.update(Float32Array.from([1, 0]))]).toEqual([191, 64]);
  });

  it("keeps values in range", () => {
    const smoother = new MaskSmoother(1);
    expect([...smoother.update(Float32Array.from([-0.2, 1.3]))]).toEqual([
      0, 255,
    ]);
  });

  it("starts over when the mask's size changes", () => {
    const smoother = new MaskSmoother(0.5);
    smoother.update(Float32Array.from([0, 0]));
    expect([...smoother.update(Float32Array.from([1, 1, 1]))]).toEqual([
      255, 255, 255,
    ]);
  });
});

describe("FrameBudget", () => {
  it("steps down when most frames run over", () => {
    const budget = new FrameBudget(20, 10, 0);
    const results = Array.from({ length: 10 }, (_, i) =>
      budget.record(i < 7 ? 30 : 10),
    );
    expect(results.slice(0, 9)).not.toContain(true);
    expect(results[9]).toBe(true);
  });

  it("keeps going when most frames fit", () => {
    const budget = new FrameBudget(20, 10, 0);
    const results = Array.from({ length: 10 }, (_, i) =>
      budget.record(i < 5 ? 30 : 10),
    );
    expect(results).not.toContain(true);
  });

  it("ignores the first frames while things warm up", () => {
    const budget = new FrameBudget(20, 2, 3);
    expect([30, 30, 30].map((ms) => budget.record(ms))).toEqual([
      false,
      false,
      false,
    ]);
    expect([30, 30].map((ms) => budget.record(ms))).toEqual([false, true]);
  });
});
