import { describe, expect, it } from "vitest";

import { fitGrid } from "./grid";

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
});
