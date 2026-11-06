import { describe, expect, it } from "vitest";

import {
  areaAfterKey,
  areaBetween,
  clampArea,
  cropRect,
  initialArea,
  MIN_SHARE,
  moveArea,
  resizeArea,
  type Area,
} from "./area";

const near = (area: Area) => ({
  x: Number(area.x.toFixed(4)),
  y: Number(area.y.toFixed(4)),
  width: Number(area.width.toFixed(4)),
  height: Number(area.height.toFixed(4)),
});

describe("the box to start from", () => {
  it("is 16:9 on the screen, two thirds of the side that limits it, in the middle", () => {
    // A 16:9 screen: two thirds each way.
    expect(near(initialArea(1920, 1080))).toEqual(
      near({ x: 1 / 6, y: 1 / 6, width: 2 / 3, height: 2 / 3 }),
    );
    // A 16:10 screen: the width limits it, so it's shorter than two thirds of the height.
    const tall = initialArea(1920, 1200);
    expect(tall.width).toBeCloseTo(2 / 3);
    expect((tall.width * 1920) / (tall.height * 1200)).toBeCloseTo(16 / 9);
    expect(tall.y).toBeCloseTo((1 - tall.height) / 2);
    // An ultrawide one: the height limits it.
    const wide = initialArea(3440, 1440);
    expect(wide.height).toBeCloseTo(2 / 3);
    expect((wide.width * 3440) / (wide.height * 1440)).toBeCloseTo(16 / 9);
  });

  it("is two thirds each way on a screen of unknown size", () => {
    expect(initialArea(0, 0)).toEqual({
      x: 1 / 6,
      y: 1 / 6,
      width: 2 / 3,
      height: 2 / 3,
    });
  });
});

describe("moving and resizing the box", () => {
  const box = { x: 0.2, y: 0.2, width: 0.4, height: 0.3 };

  it("moves, stopping at the screen's edges", () => {
    expect(near(moveArea(box, 0.1, -0.05))).toEqual(
      near({ x: 0.3, y: 0.15, width: 0.4, height: 0.3 }),
    );
    expect(near(moveArea(box, 1, 1))).toEqual(
      near({ x: 0.6, y: 0.7, width: 0.4, height: 0.3 }),
    );
    expect(moveArea(box, -1, -1)).toMatchObject({ x: 0, y: 0 });
  });

  it("resizes from the edges it's dragged by, leaving the others where they are", () => {
    expect(
      near(resizeArea(box, { right: true, bottom: true }, 0.1, 0.1)),
    ).toEqual(near({ x: 0.2, y: 0.2, width: 0.5, height: 0.4 }));
    expect(near(resizeArea(box, { left: true }, -0.1, 0.3))).toEqual(
      near({ x: 0.1, y: 0.2, width: 0.5, height: 0.3 }),
    );
    expect(near(resizeArea(box, { top: true }, 0, 0.1))).toEqual(
      near({ x: 0.2, y: 0.3, width: 0.4, height: 0.2 }),
    );
  });

  it("never grows past the screen or shrinks past the smallest size", () => {
    expect(near(resizeArea(box, { right: true }, 1, 0))).toEqual(
      near({ x: 0.2, y: 0.2, width: 0.8, height: 0.3 }),
    );
    const shrunk = resizeArea(box, { left: true, top: true }, 1, 1);
    expect(shrunk.width).toBeCloseTo(MIN_SHARE);
    expect(shrunk.height).toBeCloseTo(MIN_SHARE);
    expect(shrunk.x + shrunk.width).toBeCloseTo(0.6);
  });

  it("draws a new box from either corner", () => {
    expect(near(areaBetween({ x: 0.7, y: 0.6 }, { x: 0.3, y: 0.2 }))).toEqual(
      near({ x: 0.3, y: 0.2, width: 0.4, height: 0.4 }),
    );
    // Off the screen, it stops at the edge.
    expect(near(areaBetween({ x: 0.5, y: 0.5 }, { x: 1.4, y: -0.2 }))).toEqual(
      near({ x: 0.5, y: 0, width: 0.5, height: 0.5 }),
    );
    // A click, not a drag, still makes a box of the smallest size.
    expect(areaBetween({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toMatchObject({
      width: MIN_SHARE,
      height: MIN_SHARE,
    });
  });

  it("keeps a box from elsewhere on the screen", () => {
    expect(clampArea({ x: -0.2, y: 0.9, width: 1.5, height: 0.3 })).toEqual({
      x: 0,
      y: 0.7,
      width: 1,
      height: 0.3,
    });
  });
});

describe("the keyboard", () => {
  const box = { x: 0.2, y: 0.2, width: 0.4, height: 0.3 };

  it("moves the box with the arrow keys", () => {
    expect(near(areaAfterKey(box, "ArrowRight", false)!)).toEqual(
      near({ ...box, x: 0.21 }),
    );
    expect(near(areaAfterKey(box, "ArrowUp", false)!)).toEqual(
      near({ ...box, y: 0.19 }),
    );
  });

  it("resizes it with Shift: right and down larger, left and up smaller", () => {
    expect(near(areaAfterKey(box, "ArrowRight", true)!)).toEqual(
      near({ ...box, width: 0.41 }),
    );
    expect(near(areaAfterKey(box, "ArrowUp", true)!)).toEqual(
      near({ ...box, height: 0.29 }),
    );
  });

  it("leaves other keys alone", () => {
    expect(areaAfterKey(box, "Tab", false)).toBeNull();
    expect(areaAfterKey(box, "a", true)).toBeNull();
  });
});

describe("the pixels cropped", () => {
  it("are the box's, on even coordinates and sizes", () => {
    expect(
      cropRect({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, 1920, 1080),
    ).toEqual({ x: 480, y: 270, width: 960, height: 540 });
    // 0.1 of 1365 is 136.5: down to 136; 0.33 of 1365 is 450.45: down to 450.
    expect(
      cropRect({ x: 0.1, y: 0.1, width: 0.33, height: 0.33 }, 1365, 767),
    ).toEqual({ x: 136, y: 76, width: 450, height: 252 });
  });

  it("never reach outside the frame", () => {
    const rect = cropRect(
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
      1366,
      769,
    );
    expect(rect.x + rect.width).toBeLessThanOrEqual(1366);
    expect(rect.y + rect.height).toBeLessThanOrEqual(769);
    expect(rect.width % 2).toBe(0);
    expect(rect.height % 2).toBe(0);
  });
});
