import { describe, expect, it } from "vitest";

import { spaceTalks } from "./push-to-talk";

describe("spaceTalks", () => {
  const held = {
    pushToTalk: true,
    singleKeyShortcuts: true,
    plain: true,
    typing: false,
    onControl: false,
    keyboardFocus: false,
  };

  it("talks while Space is held, with Push to talk on", () => {
    expect(spaceTalks(held)).toBe(true);
    expect(spaceTalks({ ...held, pushToTalk: false })).toBe(false);
    expect(spaceTalks({ ...held, singleKeyShortcuts: false })).toBe(false);
  });

  it("still talks on a control you clicked, so Space never toggles the mic", () => {
    expect(spaceTalks({ ...held, onControl: true })).toBe(true);
  });

  it("leaves Space to a control reached with the keyboard, and to typing", () => {
    expect(spaceTalks({ ...held, onControl: true, keyboardFocus: true })).toBe(
      false,
    );
    expect(spaceTalks({ ...held, typing: true })).toBe(false);
    expect(spaceTalks({ ...held, plain: false })).toBe(false);
  });
});
