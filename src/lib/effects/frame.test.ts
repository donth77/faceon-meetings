import { describe, expect, it } from "vitest";

import {
  coverScale,
  FrameBudget,
  FramePacer,
  MaskSmoother,
  uncertainty,
  wideCrop,
} from "./frame";

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

  it("takes a value the model is sure of at once, so edges keep up", () => {
    const smoother = new MaskSmoother();
    smoother.update(Float32Array.from([0, 1]));
    expect([...smoother.update(Float32Array.from([1, 0]))]).toEqual([255, 0]);
  });

  it("steadies a value the model is unsure of with the last frame", () => {
    const smoother = new MaskSmoother(0.5);
    smoother.update(Float32Array.from([0]));
    // 0.5 is as unsure as it gets: half of the last frame stays.
    expect([...smoother.update(Float32Array.from([0.5]))]).toEqual([64]);
    expect([...smoother.update(Float32Array.from([0.5]))]).toEqual([96]);
  });

  it("keeps values in range", () => {
    const smoother = new MaskSmoother(1);
    expect([...smoother.update(Float32Array.from([-0.2, 1.3]))]).toEqual([
      0, 255,
    ]);
    expect([...smoother.update(Float32Array.from([-5, 9]))]).toEqual([0, 255]);
  });

  it("starts over when the mask's size changes", () => {
    const smoother = new MaskSmoother(0.5);
    smoother.update(Float32Array.from([0, 0]));
    expect([...smoother.update(Float32Array.from([1, 1, 1]))]).toEqual([
      255, 255, 255,
    ]);
  });
});

describe("uncertainty", () => {
  it("is greatest at 0.5 and gone at 0 and 1", () => {
    expect(uncertainty(0.5)).toBe(1);
    expect(uncertainty(0)).toBeCloseTo(0, 2);
    expect(uncertainty(1)).toBeCloseTo(0, 2);
  });

  it("falls the surer the model is, the same either way", () => {
    expect(uncertainty(0.75)).toBeLessThan(uncertainty(0.6));
    expect(uncertainty(0.9)).toBeLessThan(uncertainty(0.75));
    expect(uncertainty(0.25)).toBeCloseTo(uncertainty(0.75), 6);
  });
});

describe("FramePacer", () => {
  /**
   * A 30-a-second timer for `ms`, with the browser saying it showed a camera frame every
   * `frameEvery` ms until `framesUntil`: the times of the ticks that drew.
   */
  function ticks(
    pacer: FramePacer,
    {
      ms,
      frameEvery,
      framesUntil = ms,
    }: { ms: number; frameEvery: number; framesUntil?: number },
  ) {
    const drew: number[] = [];
    let frame = 0;
    for (let now = 5; now < ms; now += 1000 / 30) {
      for (; frame <= now && frame < framesUntil; frame += frameEvery) {
        pacer.shown(frame);
      }
      if (pacer.due(now)) {
        pacer.done();
        drew.push(now);
      }
    }
    return drew;
  }

  it("draws each frame of a camera slower than the timer once", () => {
    const drew = ticks(new FramePacer(250), {
      ms: 1000,
      frameEvery: 1000 / 15,
    });
    expect(drew).toHaveLength(15);
  });

  it("draws on every tick where the browser never says when it shows a frame", () => {
    const drew = ticks(new FramePacer(250), {
      ms: 1000,
      frameEvery: 1000 / 15,
      framesUntil: 0,
    });
    expect(drew).toHaveLength(30);
  });

  it("draws on every tick once the browser stops saying, as in a background tab", () => {
    const camera = { ms: 1500, frameEvery: 1000 / 15 };
    const drew = ticks(new FramePacer(250), { ...camera, framesUntil: 500 });
    const everyTick = ticks(new FramePacer(250), { ...camera, framesUntil: 0 });
    // Quiet from the last frame, at 467 ms; every tick draws from 250 ms after it.
    expect(drew.filter((at) => at > 500 && at < 700)).toEqual([]);
    expect(drew.filter((at) => at > 720)).toEqual(
      everyTick.filter((at) => at > 720),
    );
  });

  it("draws a frame on the next tick when this one couldn't", () => {
    const pacer = new FramePacer(250);
    pacer.shown(0);
    expect(pacer.due(5)).toBe(true);
    // Not drawn (the GPU was busy), so not done.
    expect(pacer.due(38)).toBe(true);
    pacer.done();
    expect(pacer.due(71)).toBe(false);
  });

  it("draws on every tick from when the page goes to the background until word comes", () => {
    const pacer = new FramePacer(250);
    pacer.shown(0);
    pacer.done();
    expect(pacer.due(5)).toBe(false);
    pacer.forget();
    expect(pacer.due(10)).toBe(true);
    pacer.done();
    expect(pacer.due(43)).toBe(true);
    pacer.shown(60);
    pacer.done();
    expect(pacer.due(76)).toBe(false);
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
