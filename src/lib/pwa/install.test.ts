import { describe, expect, it } from "vitest";

import { installWay } from "./install";

const UA = {
  iPhoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iPhoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 Mobile/15E148 Safari/604.1",
  // An iPad asks for desktop sites with the Mac's user agent.
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  macFirefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:140.0) Gecko/20100101 Firefox/140.0",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
};

const device = (
  userAgent: string,
  overrides: Partial<Parameters<typeof installWay>[0]> = {},
) => ({
  standalone: false,
  installed: false,
  canPrompt: false,
  userAgent,
  touchPoints: 0,
  ...overrides,
});

describe("installWay", () => {
  it("offers the browser's prompt where there is one (Chrome, Edge, Android)", () => {
    expect(installWay(device(UA.windowsEdge, { canPrompt: true }))).toBe(
      "prompt",
    );
    expect(installWay(device(UA.androidChrome, { canPrompt: true }))).toBe(
      "prompt",
    );
  });

  it("explains Add to Home Screen on an iPhone or iPad, in any browser", () => {
    expect(installWay(device(UA.iPhoneSafari, { touchPoints: 5 }))).toBe("ios");
    expect(installWay(device(UA.iPhoneChrome, { touchPoints: 5 }))).toBe("ios");
    expect(installWay(device(UA.macSafari, { touchPoints: 5 }))).toBe("ios");
  });

  it("explains Add to Dock in Safari on a Mac", () => {
    expect(installWay(device(UA.macSafari))).toBe("macSafari");
  });

  it("offers nothing where the browser can't install, or hasn't offered to yet", () => {
    expect(installWay(device(UA.macFirefox))).toBe("none");
    expect(installWay(device(UA.macChrome))).toBe("none");
    expect(installWay(device(UA.androidChrome))).toBe("none");
  });

  it("knows when it's already the app", () => {
    expect(
      installWay(device(UA.iPhoneSafari, { standalone: true, touchPoints: 5 })),
    ).toBe("installed");
    expect(
      installWay(device(UA.windowsEdge, { installed: true, canPrompt: true })),
    ).toBe("installed");
  });
});
