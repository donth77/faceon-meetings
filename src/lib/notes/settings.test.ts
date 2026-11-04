import { describe, expect, it } from "vitest";

import { fromStored } from "./settings";

describe("AI notes settings carried over from the choice of how notes were made", () => {
  it("keep On this computer free: a key kept beside it is removed, and that's said", () => {
    expect(
      fromStored({
        engine: "onDevice",
        provider: "anthropic",
        models: { anthropic: "claude-haiku-4-5" },
        keys: { anthropic: "sk-ant", openai: "sk" },
      }),
    ).toEqual({
      settings: {
        provider: "anthropic",
        models: { anthropic: "claude-haiku-4-5" },
        keyRemoved: true,
      },
      migrated: true,
    });
  });

  it("keep On this computer free with nothing to say where there was no key", () => {
    expect(fromStored({ engine: "onDevice" })).toEqual({
      settings: {},
      migrated: true,
    });
    expect(fromStored({ engine: "onDevice", keys: {} })).toEqual({
      settings: {},
      migrated: true,
    });
  });

  it("keep using a saved key that was the choice", () => {
    expect(
      fromStored({
        engine: "ownKey",
        provider: "google",
        keys: { google: "AIza" },
      }),
    ).toEqual({
      settings: { provider: "google", keys: { google: "AIza" } },
      migrated: true,
    });
  });

  it("leave settings without a choice as they are", () => {
    const settings = { provider: "openai", keys: { openai: "sk" } } as const;
    expect(fromStored(settings)).toEqual({ settings, migrated: false });
    expect(fromStored({})).toEqual({ settings: {}, migrated: false });
  });

  it("keep the note that a key was removed until it's put away", () => {
    expect(fromStored({ keyRemoved: true })).toEqual({
      settings: { keyRemoved: true },
      migrated: false,
    });
  });

  it("drop what isn't settings", () => {
    expect(
      fromStored({ engine: "somewhere", keys: { nobody: "x", openai: "" } }),
    ).toEqual({ settings: { keys: {} }, migrated: false });
    expect(fromStored("not settings")).toEqual({
      settings: {},
      migrated: false,
    });
  });
});
