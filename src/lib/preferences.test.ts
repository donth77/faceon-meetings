import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPreferences, withDefaults } from "./preferences";

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
