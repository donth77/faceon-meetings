import { describe, expect, it } from "vitest";

import { mayHide, shownAfterTap, type RoomFacts } from "./controls-visibility";

/** A settled phone room with nothing open: the controls may hide. */
const quiet: RoomFacts = {
  compact: true,
  settled: true,
  presenting: false,
  alone: false,
  overlayOpen: false,
  focusInControls: false,
  kept: false,
};

describe("mayHide", () => {
  it("lets a phone's controls go once the room is quiet", () => {
    expect(mayHide(quiet)).toBe(true);
  });

  it("never hides on larger screens", () => {
    expect(mayHide({ ...quiet, compact: false })).toBe(false);
  });

  it.each<[string, Partial<RoomFacts>]>([
    ["right after joining, or while reconnecting", { settled: false }],
    ["while you share your screen", { presenting: true }],
    ["while you're the only one here", { alone: true }],
    [
      "while a sheet, menu, dialog or toast with a button is open",
      { overlayOpen: true },
    ],
    ["while focus is on a control", { focusInControls: true }],
    ["after a screen reader asked for them", { kept: true }],
  ])("keeps them %s", (_, change) => {
    expect(mayHide({ ...quiet, ...change })).toBe(false);
  });
});

describe("shownAfterTap", () => {
  it("brings hidden controls back", () => {
    expect(shownAfterTap(false, quiet)).toBe(true);
    expect(shownAfterTap(false, { ...quiet, compact: false })).toBe(true);
  });

  it("hides shown controls when they may go", () => {
    expect(shownAfterTap(true, quiet)).toBe(false);
  });

  it("keeps them while something holds them", () => {
    expect(shownAfterTap(true, { ...quiet, overlayOpen: true })).toBe(true);
    expect(shownAfterTap(true, { ...quiet, settled: false })).toBe(true);
  });

  it("lets a tap end a screen reader's request", () => {
    expect(shownAfterTap(true, { ...quiet, kept: true })).toBe(false);
  });
});
