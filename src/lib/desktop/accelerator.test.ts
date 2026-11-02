import { describe, expect, it } from "vitest";

import {
  acceleratorFromKey,
  formatAccelerator,
  isAccelerator,
} from "./accelerator";

const press = (
  code: string,
  keys: Partial<Record<"ctrl" | "meta" | "alt" | "shift", boolean>> = {},
) => ({
  code,
  ctrlKey: keys.ctrl ?? false,
  metaKey: keys.meta ?? false,
  altKey: keys.alt ?? false,
  shiftKey: keys.shift ?? false,
});

describe("isAccelerator", () => {
  it("takes modifiers and one key", () => {
    for (const ok of [
      "CommandOrControl+Shift+A",
      "Alt+M",
      "Ctrl+Alt+F5",
      "Control+Space",
    ]) {
      expect(isAccelerator(ok)).toBe(true);
    }
  });

  it("never takes ordinary typing, or anything odd", () => {
    for (const bad of [
      "A",
      "Shift+A",
      "Shift+Space",
      "Ctrl+",
      "Ctrl+Ctrl+A",
      "Ctrl+Shift+Alt+Super+A",
      "Ctrl+Enter",
    ]) {
      expect(isAccelerator(bad)).toBe(false);
    }
  });
});

describe("acceleratorFromKey", () => {
  it("turns a key press into a shortcut, by platform", () => {
    expect(
      acceleratorFromKey(press("KeyM", { meta: true, shift: true }), "mac"),
    ).toBe("CommandOrControl+Shift+M");
    expect(
      acceleratorFromKey(press("KeyM", { ctrl: true, shift: true }), "windows"),
    ).toBe("CommandOrControl+Shift+M");
    expect(acceleratorFromKey(press("Digit5", { alt: true }), "windows")).toBe(
      "Alt+5",
    );
  });

  it("refuses a key alone, Shift alone and keys it can't use", () => {
    expect(acceleratorFromKey(press("KeyM"), "windows")).toBeNull();
    expect(
      acceleratorFromKey(press("KeyM", { shift: true }), "windows"),
    ).toBeNull();
    expect(
      acceleratorFromKey(press("Enter", { ctrl: true }), "windows"),
    ).toBeNull();
  });
});

describe("formatAccelerator", () => {
  it("reads as each system writes shortcuts", () => {
    expect(formatAccelerator("CommandOrControl+Shift+A", "mac")).toBe("⇧⌘A");
    expect(formatAccelerator("CommandOrControl+Shift+A", "windows")).toBe(
      "Ctrl+Shift+A",
    );
  });
});
