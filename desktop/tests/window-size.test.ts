import { describe, expect, it } from "vitest";

import { firstWindowSize, MENU_BAR_HEIGHT } from "../src/main/window-size";

describe("firstWindowSize", () => {
  const roomy = { width: 1920, height: 1032 };

  it("makes room for the menu bar on Windows and Linux, so the page keeps its height", () => {
    expect(firstWindowSize(roomy, "win32")).toEqual({
      width: 1280,
      height: 820 + MENU_BAR_HEIGHT,
    });
    expect(firstWindowSize(roomy, "linux")).toEqual({
      width: 1280,
      height: 820 + MENU_BAR_HEIGHT,
    });
  });

  it("has no menu bar to make room for on a Mac", () => {
    expect(firstWindowSize(roomy, "darwin")).toEqual({
      width: 1280,
      height: 820,
    });
  });

  it("takes about 90% of a smaller screen, never more", () => {
    expect(firstWindowSize({ width: 1366, height: 728 }, "win32")).toEqual({
      width: 1229,
      height: 655,
    });
  });
});
