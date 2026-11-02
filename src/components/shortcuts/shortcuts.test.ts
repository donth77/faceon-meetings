import { describe, expect, it } from "vitest";

import { shortcutsFor } from "./shortcuts";

const combosOf = (
  groups: ReturnType<typeof shortcutsFor>,
  id: string,
): string[][] | undefined =>
  groups
    .flatMap((group) => group.shortcuts)
    .find((shortcut) => shortcut.id === id)?.combos;

describe("shortcutsFor", () => {
  it("lists both styles of keys for the platform", () => {
    const other = shortcutsFor({
      apple: false,
      singleKeys: true,
      pushToTalk: false,
    });
    expect(combosOf(other, "mute")).toEqual([
      ["Ctrl", "D"],
      ["Alt", "A"],
    ]);
    expect(combosOf(other, "shortcuts")).toEqual([["?"], ["Ctrl", "/"]]);

    const apple = shortcutsFor({
      apple: true,
      singleKeys: true,
      pushToTalk: false,
    });
    expect(combosOf(apple, "mute")).toEqual([
      ["⌘", "D"],
      ["⌥", "A"],
    ]);
    expect(combosOf(apple, "shortcuts")).toEqual([["?"], ["⌘", "/"]]);
  });

  it("keeps the meeting's shortcuts first", () => {
    const groups = shortcutsFor({
      apple: false,
      singleKeys: true,
      pushToTalk: false,
    });
    expect(groups.map((group) => group.id)).toEqual(["meeting", "anywhere"]);
  });

  it("lists Space to talk only with Push to talk on", () => {
    const off = shortcutsFor({
      apple: false,
      singleKeys: true,
      pushToTalk: false,
    });
    expect(combosOf(off, "talk")).toBeUndefined();
    const on = shortcutsFor({
      apple: false,
      singleKeys: true,
      pushToTalk: true,
    });
    expect(combosOf(on, "talk")).toEqual([["Space"]]);
  });

  it("leaves out single keys when they're turned off", () => {
    const groups = shortcutsFor({
      apple: false,
      singleKeys: false,
      pushToTalk: true,
    });
    expect(combosOf(groups, "shortcuts")).toEqual([["Ctrl", "/"]]);
    // Space is a single key, so Space to talk goes too.
    expect(combosOf(groups, "talk")).toBeUndefined();
    expect(combosOf(groups, "mute")).toHaveLength(2);
  });
});
