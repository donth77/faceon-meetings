import { describe, expect, it } from "vitest";

import {
  copyVersion,
  ownerOf,
  shouldUpdate,
  UPDATE_RETRY_MS,
} from "./setup-rules";

const ada = { userId: "u_ada", googleSub: "1077" };
const bo = { userId: "u_bo", googleSub: "2088" };

describe("ownerOf", () => {
  it("knows a connected add-on only from its owner's Google account", () => {
    expect(ownerOf({ sub: "1077", byClient: ada, byToken: null })).toEqual({
      ...ada,
      connects: false,
    });
    // Ada's copy, shared with Bo and used from his account, doesn't work for him.
    expect(ownerOf({ sub: "2088", byClient: ada, byToken: null })).toBeNull();
  });

  it("connects a new copy with its token, from the account it was made in", () => {
    expect(ownerOf({ sub: "1077", byClient: null, byToken: ada })).toEqual({
      ...ada,
      connects: true,
    });
    // Someone else with Ada's token (her copy, shared before she used it) can't.
    expect(ownerOf({ sub: "2088", byClient: null, byToken: ada })).toBeNull();
    expect(ownerOf({ sub: "1077", byClient: null, byToken: null })).toBeNull();
  });

  it("never moves a connected add-on to someone else's token", () => {
    expect(ownerOf({ sub: "2088", byClient: ada, byToken: bo })).toBeNull();
  });
});

describe("shouldUpdate", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const base = {
    reported: "a1b2c3",
    current: "d4e5f6",
    refusedAt: null,
    triedAt: null,
    now,
  };

  it("updates an add-on that runs an older build", () => {
    expect(shouldUpdate(base)).toBe(true);
    expect(shouldUpdate({ ...base, reported: "d4e5f6" })).toBe(false);
  });

  it("leaves developers' builds, and requests that don't say, alone", () => {
    expect(shouldUpdate({ ...base, reported: "dev" })).toBe(false);
    expect(shouldUpdate({ ...base, reported: null })).toBe(false);
  });

  it("waits for the person once Google refused, and between tries", () => {
    expect(shouldUpdate({ ...base, refusedAt: new Date(0) })).toBe(false);
    const justTried = new Date(now.getTime() - 60_000);
    expect(shouldUpdate({ ...base, triedAt: justTried })).toBe(false);
    const longAgo = new Date(now.getTime() - UPDATE_RETRY_MS);
    expect(shouldUpdate({ ...base, triedAt: longAgo })).toBe(true);
  });
});

describe("copyVersion", () => {
  const copy = {
    url: "https://faceon.test",
    name: "FaceOn",
    logoUrl: "https://faceon.test/icons/icon-192.png",
    conferenceLogoUrl: "https://lh3.googleusercontent.com/one",
  };

  it("is the same for the same build and copy", () => {
    expect(copyVersion("766aeb6c7ce2", copy)).toBe(
      copyVersion("766aeb6c7ce2", { ...copy }),
    );
  });

  it("changes with the build, and with what FaceOn writes into the copy", () => {
    const version = copyVersion("766aeb6c7ce2", copy);
    expect(copyVersion("0a1b2c3d4e5f", copy)).not.toBe(version);
    // A new logo reaches copies whose code hasn't changed.
    expect(
      copyVersion("766aeb6c7ce2", {
        ...copy,
        conferenceLogoUrl: "https://lh3.googleusercontent.com/two",
      }),
    ).not.toBe(version);
    expect(
      copyVersion("766aeb6c7ce2", { ...copy, url: "https://meet.test" }),
    ).not.toBe(version);
  });

  it("never matches a developer's build", () => {
    expect(copyVersion("766aeb6c7ce2", copy)).not.toBe("dev");
  });
});
