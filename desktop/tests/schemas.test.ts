import { describe, expect, it } from "vitest";

import {
  AppPath,
  Command,
  parseAppState,
  PreferencesChange,
} from "../src/main/schemas";

describe("parseAppState", () => {
  it("starts from the defaults, and keeps what's valid", () => {
    expect(parseAppState({})).toEqual({
      preferences: {
        launchAtLogin: false,
        keepInTray: true,
        openLinksInApp: true,
        muteShortcut: {
          enabled: true,
          accelerator: "CommandOrControl+Shift+A",
        },
        badge: true,
        channel: "latest",
      },
      reminderMinutes: 0,
    });
    expect(
      parseAppState({ preferences: { badge: false }, reminderMinutes: 10 })
        .preferences.badge,
    ).toBe(false);
  });

  it("falls back to the defaults when the file is damaged", () => {
    expect(parseAppState("garbage").preferences.keepInTray).toBe(true);
    expect(parseAppState({ reminderMinutes: 7 }).reminderMinutes).toBe(0);
  });
});

describe("PreferencesChange", () => {
  it("accepts known settings only", () => {
    expect(PreferencesChange.safeParse({ badge: false }).success).toBe(true);
    expect(PreferencesChange.safeParse({ badge: "no" }).success).toBe(false);
    expect(PreferencesChange.safeParse({ admin: true }).success).toBe(false);
  });

  it("checks the mute shortcut", () => {
    const shortcut = (accelerator: string) =>
      PreferencesChange.safeParse({
        muteShortcut: { enabled: true, accelerator },
      }).success;
    for (const ok of ["CommandOrControl+Shift+A", "Alt+M", "Ctrl+Alt+F5"]) {
      expect(shortcut(ok)).toBe(true);
    }
    for (const bad of [
      "A",
      "Shift+A",
      "Ctrl+",
      "Ctrl+Shift+Alt+Super+A",
      "Ctrl+Enter;rm",
    ]) {
      expect(shortcut(bad)).toBe(false);
    }
  });
});

describe("AppPath and Command", () => {
  it("allow only paths on the app's own origin", () => {
    expect(AppPath.safeParse("/settings/calendar").success).toBe(true);
    for (const bad of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "home",
    ]) {
      expect(AppPath.safeParse(bad).success).toBe(false);
    }
    expect(
      Command.safeParse({ type: "open", path: "//evil.com" }).success,
    ).toBe(false);
    expect(Command.safeParse({ type: "toggleMute" }).success).toBe(true);
  });
});
