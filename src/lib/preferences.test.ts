import { afterEach, describe, expect, it, vi } from "vitest";

import {
  chosenSettings,
  DEFAULTS,
  loadPreferences,
  preferencePatch,
  setPreference,
  withDefaults,
  type Preferences,
} from "./preferences";

/** A stand-in for the browser's storage, holding what an earlier version saved. */
function stored(value: unknown) {
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify(value),
    setItem: () => {},
  });
}

describe("loadPreferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts from the defaults", () => {
    stored(null);
    expect(withDefaults(loadPreferences())).toMatchObject({
      soundPeople: true,
      popupChat: true,
      pushToTalk: false,
      reactionSound: false,
      reactionAnnouncements: "summary",
    });
  });

  it("keeps every sound off for someone who turned Meeting sounds off", () => {
    stored({ meetingSounds: false });
    expect(withDefaults(loadPreferences())).toMatchObject({
      soundPeople: false,
      soundChat: false,
      soundHands: false,
      soundLobby: false,
      popupChat: true,
    });
  });

  it("turns announcements off for someone who turned Announce reactions off", () => {
    stored({ announceReactions: false });
    expect(loadPreferences().reactionAnnouncements).toBe("off");
  });

  it("prefers a newer choice over an old switch", () => {
    stored({ announceReactions: false, reactionAnnouncements: "each" });
    expect(loadPreferences().reactionAnnouncements).toBe("each");
  });

  it("ignores values it doesn't know", () => {
    stored({
      timeFormat: "36",
      pushToTalk: "yes",
      reactionAnnouncements: "loud",
    });
    expect(loadPreferences()).toEqual({});
  });
});

describe("withDefaults", () => {
  it("fills in every default", () => {
    expect(withDefaults({})).toEqual(DEFAULTS);
  });

  it("keeps what was chosen", () => {
    const settings = withDefaults({
      hdVideo: false,
      reminderMinutes: 15,
      effect: { kind: "blur", level: "slight" },
    });
    expect(settings.hdVideo).toBe(false);
    expect(settings.reminderMinutes).toBe(15);
    expect(settings.effect).toEqual({ kind: "blur", level: "slight" });
    expect(settings.mirrorVideo).toBe(DEFAULTS.mirrorVideo);
  });
});

describe("Notifications", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is on to start", () => {
    expect(DEFAULTS.notifications).toBe(true);
  });

  it("pauses every sound, pop-up and reminder while off, keeping each choice", () => {
    const preferences: Preferences = {
      notifications: false,
      soundChat: true,
      popupHands: true,
      reactionSound: true,
      reminderMinutes: 10,
    };
    expect(withDefaults(preferences)).toMatchObject({
      soundPeople: false,
      soundChat: false,
      soundHands: false,
      soundLobby: false,
      popupChat: false,
      popupHands: false,
      popupLobby: false,
      reactionSound: false,
      reminderMinutes: 0,
    });
    expect(chosenSettings(preferences)).toMatchObject({
      soundChat: true,
      popupHands: true,
      reactionSound: true,
      reminderMinutes: 10,
    });
  });

  it("leaves screen readers and everything else as they are", () => {
    const settings = withDefaults({
      notifications: false,
      reactionAnnouncements: "each",
      showOthersReactions: false,
    });
    expect(settings.reactionAnnouncements).toBe("each");
    expect(settings.showOthersReactions).toBe(false);
    expect(settings.reactionAnimation).toBe(DEFAULTS.reactionAnimation);
  });

  it("brings each choice back when it's on again", () => {
    expect(
      withDefaults({
        notifications: true,
        soundChat: false,
        reminderMinutes: 15,
      }),
    ).toMatchObject({
      soundChat: false,
      soundPeople: true,
      reminderMinutes: 15,
    });
  });

  it("reads the switch from storage", () => {
    stored({ notifications: false });
    expect(loadPreferences().notifications).toBe(false);
  });
});

describe("preferencePatch", () => {
  it("stores nothing for a default", () => {
    expect(preferencePatch("hdVideo", true)).toEqual({ hdVideo: undefined });
    expect(preferencePatch("pushToTalk", false)).toEqual({
      pushToTalk: undefined,
    });
    expect(preferencePatch("reminderMinutes", 5)).toEqual({
      reminderMinutes: undefined,
    });
    expect(preferencePatch("effect", null)).toEqual({ effect: undefined });
  });

  it("stores anything else", () => {
    expect(preferencePatch("hdVideo", false)).toEqual({ hdVideo: false });
    expect(preferencePatch("pushToTalk", true)).toEqual({ pushToTalk: true });
    expect(preferencePatch("reminderMinutes", 10)).toEqual({
      reminderMinutes: 10,
    });
    expect(preferencePatch("effect", { kind: "motion", id: "aurora" })).toEqual(
      { effect: { kind: "motion", id: "aurora" } },
    );
  });
});

describe("setPreference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a change and forgets a return to the default", () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    });
    vi.stubGlobal("window", { dispatchEvent: () => true });

    setPreference("hdVideo", false);
    expect(loadPreferences()).toEqual({ hdVideo: false });
    setPreference("pushToTalk", true);
    expect(loadPreferences()).toEqual({ hdVideo: false, pushToTalk: true });
    setPreference("hdVideo", true);
    expect(loadPreferences()).toEqual({ pushToTalk: true });
  });
});
