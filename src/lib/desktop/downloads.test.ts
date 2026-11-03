import { describe, expect, it } from "vitest";

import {
  desktopAssetNames,
  deviceKind,
  formatSize,
  pickInstallers,
  versionFromDownloadUrl,
} from "./downloads";

const AGENTS = {
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  linux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  iPhone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

describe("which computer this is", () => {
  it("knows Windows and the Mac, the desktop app's", () => {
    expect(deviceKind(AGENTS.windows, 0)).toBe("windows");
    expect(deviceKind(AGENTS.mac, 0)).toBe("mac");
  });

  it("an iPad says it's a Mac, but has a touch screen", () => {
    expect(deviceKind(AGENTS.mac, 5)).toBe("phoneOrTablet");
  });

  it("other computers (Linux, ChromeOS) get no desktop app", () => {
    expect(deviceKind(AGENTS.linux, 0)).toBe("otherComputer");
    expect(deviceKind(AGENTS.chromeOs, 0)).toBe("otherComputer");
  });

  it("phones and tablets are neither", () => {
    expect(deviceKind(AGENTS.iPhone, 5)).toBe("phoneOrTablet");
    expect(deviceKind(AGENTS.androidPhone, 5)).toBe("phoneOrTablet");
    expect(deviceKind(AGENTS.androidTablet, 10)).toBe("phoneOrTablet");
  });
});

const file = (name: string, size = 1000) => ({
  name,
  size,
  browser_download_url: `https://github.com/acme/releases/releases/download/v1.2.3/${name}`,
});
const names = desktopAssetNames("FaceOn");

describe("each platform's installer in a release", () => {
  it("has the same names in every release", () => {
    expect(names).toEqual({ windows: "FaceOn-Setup.exe", mac: "FaceOn.dmg" });
    expect(desktopAssetNames("Face On!")).toEqual({
      windows: "Face-On-Setup.exe",
      mac: "Face-On.dmg",
    });
  });

  it("finds them by name, not the updater's files beside them", () => {
    const found = pickInstallers(
      [
        file("FaceOn-Setup.exe.blockmap"),
        file("latest.yml"),
        file("FaceOn-mac.zip"),
        file("FaceOn-Setup.exe", 71_303_168),
        file("FaceOn.dmg", 98_566_144),
      ],
      names,
    );
    expect(found.windows?.name).toBe("FaceOn-Setup.exe");
    expect(found.mac?.name).toBe("FaceOn.dmg");
  });

  it("takes older names too: the installer, and the universal disk image", () => {
    const found = pickInstallers(
      [
        file("FaceOn.Setup.0.1.0.exe"),
        file("FaceOn-0.1.0-arm64.dmg"),
        file("FaceOn-0.1.0-universal.dmg"),
      ],
      names,
    );
    expect(found.windows?.name).toBe("FaceOn.Setup.0.1.0.exe");
    expect(found.mac?.name).toBe("FaceOn-0.1.0-universal.dmg");
  });

  it("shows a platform only once its file is there (Windows may come first)", () => {
    expect(pickInstallers([file("FaceOn-Setup.exe")], names)).toEqual({
      windows: file("FaceOn-Setup.exe"),
      mac: null,
    });
  });
});

describe("what a download says", () => {
  it("the version from the file's address, when the API couldn't say", () => {
    expect(
      versionFromDownloadUrl(
        "https://github.com/acme/releases/releases/download/v1.2.3/FaceOn-Setup.exe",
      ),
    ).toBe("1.2.3");
    expect(versionFromDownloadUrl("https://example.com/FaceOn.dmg")).toBeNull();
  });

  it("its size in megabytes", () => {
    expect(formatSize(71_303_168, "en-US")).toBe("68 MB");
    expect(formatSize(1000, "en-US")).toBe("1 MB");
  });
});
