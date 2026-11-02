import { describe, expect, it } from "vitest";

import { appMeetingLink, isComputer, openInAppOffer } from "./open-in-app";

const known = {
  inApp: false,
  computer: true,
  appKnown: true,
  setting: "ask" as const,
  rejoin: false,
};

describe("openInAppOffer", () => {
  it("asks by default where this browser knows the app is installed", () => {
    expect(openInAppOffer(known)).toBe("ask");
  });

  it("opens the app at once only with Always", () => {
    expect(openInAppOffer({ ...known, setting: "always" })).toBe("launch");
  });

  it("never opens it from a browser that doesn't know it's installed", () => {
    expect(
      openInAppOffer({ ...known, appKnown: false, setting: "always" }),
    ).toBe("suggest");
    expect(openInAppOffer({ ...known, appKnown: false })).toBe("suggest");
  });

  it("offers nothing with Never, inside the app, on phones, or rejoining", () => {
    expect(openInAppOffer({ ...known, setting: "never" })).toBe("none");
    expect(
      openInAppOffer({ ...known, appKnown: false, setting: "never" }),
    ).toBe("none");
    expect(openInAppOffer({ ...known, inApp: true })).toBe("none");
    expect(openInAppOffer({ ...known, computer: false })).toBe("none");
    expect(openInAppOffer({ ...known, rejoin: true })).toBe("none");
  });
});

describe("appMeetingLink", () => {
  it("keeps the passcode after the #", () => {
    expect(appMeetingLink("1234567890", "K7XQ2M")).toBe(
      "faceon://j/1234567890#pwd=K7XQ2M",
    );
    expect(appMeetingLink("1234567890", "a@b")).toBe(
      "faceon://j/1234567890#pwd=a%40b",
    );
    expect(appMeetingLink("1234567890")).toBe("faceon://j/1234567890");
  });
});

describe("isComputer", () => {
  it("tells computers from phones and tablets", () => {
    expect(
      isComputer("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130", 0),
    ).toBe(true);
    expect(
      isComputer("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 0),
    ).toBe(true);
    expect(
      isComputer("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 5),
    ).toBe(false);
    expect(
      isComputer("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5),
    ).toBe(false);
    expect(
      isComputer("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile", 5),
    ).toBe(false);
  });
});
