import { describe, expect, it } from "vitest";

import { decideNavigation, decidePermission } from "../src/main/policy";

const APP = "https://joinfaceon.app";

describe("decideNavigation", () => {
  it("keeps the app's own pages in the window", () => {
    expect(decideNavigation(`${APP}/home`, APP)).toBe("allow");
    expect(decideNavigation(`${APP}/j/1234567890#pwd=X`, APP)).toBe("allow");
  });

  it("sends other https pages and mail links outside", () => {
    expect(decideNavigation("https://github.com/x", APP)).toBe("external");
    expect(decideNavigation("https://joinfaceon.app.evil.com/", APP)).toBe(
      "external",
    );
    expect(decideNavigation("mailto:hello@example.com", APP)).toBe("external");
  });

  it("refuses every other scheme", () => {
    for (const url of [
      "http://joinfaceon.app/home",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/html,hi",
      "faceon://j/1234567890",
      "nonsense",
    ]) {
      expect(decideNavigation(url, APP)).toBe("deny");
    }
  });
});

describe("decidePermission", () => {
  it("grants a meeting's permissions to the app's origin only", () => {
    expect(
      decidePermission("media", `${APP}/j/1`, APP, ["audio", "video"]),
    ).toBe(true);
    expect(decidePermission("display-capture", APP, APP)).toBe(true);
    expect(decidePermission("notifications", APP, APP)).toBe(true);
    expect(decidePermission("media", "https://evil.com", APP)).toBe(false);
    expect(decidePermission("media", null, APP)).toBe(false);
  });

  it("denies everything a meeting doesn't need", () => {
    for (const permission of [
      "geolocation",
      "midi",
      "pointerLock",
      "openExternal",
      "fileSystem",
      "hid",
      "serial",
      "usb",
    ]) {
      expect(decidePermission(permission, APP, APP)).toBe(false);
    }
    expect(decidePermission("media", APP, APP, ["audio", "screen"])).toBe(
      false,
    );
  });
});
