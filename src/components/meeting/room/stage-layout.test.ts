import { describe, expect, it } from "vitest";

import {
  ANY_SHAPE,
  croppable,
  exactly,
  fitBox,
  fitFocus,
  fitGrid,
  floatingShape,
  nearestShape,
  WIDESCREEN,
} from "./stage-layout";

describe("fitBox", () => {
  it("fills the space for a tile of any shape (an avatar)", () => {
    expect(fitBox(1200, 956, ANY_SHAPE)).toEqual({ width: 1200, height: 956 });
  });

  it("keeps a fixed shape in a taller space", () => {
    expect(fitBox(1200, 956, exactly(WIDESCREEN))).toEqual({
      width: 1200,
      height: 675,
    });
  });

  it("crops a camera up to the limit, then keeps the rest of its shape", () => {
    // A tall space: 16:9 loses a fifth of its width (1.42:1), no more.
    expect(fitBox(1200, 956, croppable(WIDESCREEN))).toEqual({
      width: 1200,
      height: 843,
    });
    // A wide one: a fifth of its height (2.22:1).
    expect(fitBox(1920, 700, croppable(WIDESCREEN))).toEqual({
      width: 1555,
      height: 700,
    });
  });

  it("fills a space whose shape is within the limit", () => {
    expect(fitBox(1180, 780, croppable(WIDESCREEN))).toEqual({
      width: 1180,
      height: 780,
    });
  });

  it("never crops a shared screen", () => {
    expect(fitBox(1000, 1000, exactly(16 / 10))).toEqual({
      width: 1000,
      height: 625,
    });
  });

  it("handles an unmeasured space", () => {
    expect(fitBox(0, 0, ANY_SHAPE)).toEqual({ width: 0, height: 0 });
    expect(fitBox(-10, 300, ANY_SHAPE)).toEqual({ width: 0, height: 0 });
  });
});

describe("croppable and nearestShape", () => {
  it("allows a fifth off either side of the picture", () => {
    const range = croppable(4 / 3);
    expect(range.min).toBeCloseTo(1.0667, 4);
    expect(range.max).toBeCloseTo(1.6667, 4);
  });

  it("picks the allowed shape nearest the one asked for", () => {
    expect(nearestShape(WIDESCREEN, croppable(9 / 16))).toBeCloseTo(0.7031, 4);
    expect(nearestShape(1.5, croppable(WIDESCREEN))).toBe(1.5);
  });
});

describe("fitGrid", () => {
  it("fills a wide screen with one person", () => {
    expect(fitGrid(1, 1600, 900, 0)).toEqual({
      columns: 1,
      tileWidth: 1600,
      tileHeight: 900,
    });
  });

  it("puts two people side by side on a wide screen", () => {
    expect(fitGrid(2, 1600, 900, 0).columns).toBe(2);
  });

  it("stacks two people on a phone held upright", () => {
    expect(fitGrid(2, 390, 700, 8).columns).toBe(1);
  });

  it("makes a 3 × 3 grid for nine on a 16:9 screen", () => {
    expect(fitGrid(9, 1600, 900, 0)).toMatchObject({ columns: 3 });
  });

  it("leaves room for the gaps", () => {
    const { columns, tileWidth } = fitGrid(4, 1000, 1000, 10);
    expect(columns * tileWidth + (columns - 1) * 10).toBeLessThanOrEqual(1000);
  });

  it("handles an unmeasured box", () => {
    expect(fitGrid(3, 0, 0, 8).tileWidth).toBe(0);
  });

  it("lets tiles crop a camera within the limit to use the space", () => {
    // Two people on a laptop: taller tiles side by side, not two letterboxed 16:9s.
    expect(fitGrid(2, 1440, 780, 10, croppable(WIDESCREEN))).toEqual({
      columns: 2,
      tileWidth: 715,
      tileHeight: 502,
    });
  });
});

describe("fitFocus", () => {
  it("puts the strip under the large tile on a tall stage", () => {
    // The 1200 × 956 window with three people: a row costs the large tile least.
    expect(
      fitFocus({
        width: 1200,
        height: 956,
        gap: 10,
        stripCount: 2,
        main: ANY_SHAPE,
        placeBy: croppable(WIDESCREEN),
      }),
    ).toEqual({
      strip: "row",
      stripTile: { width: 216, height: 122 },
      main: { width: 1200, height: 824 },
    });
  });

  it("puts the strip beside the large tile on a wide stage", () => {
    expect(
      fitFocus({
        width: 1440,
        height: 780,
        gap: 10,
        stripCount: 3,
        main: croppable(WIDESCREEN),
      }),
    ).toEqual({
      strip: "side",
      stripTile: { width: 250, height: 141 },
      main: { width: 1180, height: 780 },
    });
  });

  it("keeps a phone's row of 96-pixel tiles", () => {
    expect(
      fitFocus({
        width: 375,
        height: 700,
        gap: 10,
        stripCount: 4,
        main: croppable(WIDESCREEN),
      }),
    ).toMatchObject({ strip: "row", stripTile: { width: 171, height: 96 } });
  });

  it("caps the strip's tiles on a large screen, and keeps a shared screen's shape", () => {
    expect(
      fitFocus({
        width: 1920,
        height: 960,
        gap: 10,
        stripCount: 5,
        main: exactly(WIDESCREEN),
      }),
    ).toEqual({
      strip: "side",
      stripTile: { width: 256, height: 144 },
      main: { width: 1654, height: 930 },
    });
  });

  it("places the strip by the camera's shape, so it stays put as the camera goes off", () => {
    const stage = { width: 1440, height: 780, gap: 10, stripCount: 2 };
    const on = fitFocus({ ...stage, main: croppable(WIDESCREEN) });
    const off = fitFocus({
      ...stage,
      main: ANY_SHAPE,
      placeBy: croppable(WIDESCREEN),
    });
    expect(off.strip).toBe(on.strip);
    expect(off.main).toEqual({ width: 1180, height: 780 });
  });

  it("gives the whole stage to the large tile without a strip", () => {
    expect(
      fitFocus({
        width: 1200,
        height: 956,
        gap: 10,
        stripCount: 0,
        main: ANY_SHAPE,
      }),
    ).toEqual({
      strip: null,
      stripTile: { width: 0, height: 0 },
      main: { width: 1200, height: 956 },
    });
  });
});

describe("floatingShape", () => {
  it("is the usual 16:9 tile with the camera off or widescreen", () => {
    expect(floatingShape(null)).toEqual({ aspect: WIDESCREEN, widthScale: 1 });
    expect(floatingShape(WIDESCREEN)).toEqual({
      aspect: WIDESCREEN,
      widthScale: 1,
    });
  });

  it("stands up for a phone held upright, with the same area", () => {
    const { aspect, widthScale } = floatingShape(9 / 16);
    expect(aspect).toBeCloseTo(0.7031, 4);
    // Narrower and taller: width × height stays that of the 16:9 tile.
    const width = widthScale;
    const height = widthScale / aspect;
    expect(width * height).toBeCloseTo(1 / WIDESCREEN, 6);
  });
});
