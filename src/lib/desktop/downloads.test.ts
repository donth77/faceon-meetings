import { describe, expect, it } from "vitest";

import {
  desktopAssetNames,
  deviceKind,
  downloadView,
  formatSize,
  homeInstallCard,
  installOffer,
  pickInstallers,
  readReleaseReply,
  versionFromDownloadUrl,
  type DesktopRelease,
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

describe("what /download offers", () => {
  const windows = {
    url: "https://example.com/FaceOn-Setup.exe",
    size: 1,
    signed: false,
  };
  const mac = { url: "https://example.com/FaceOn.dmg", size: 1, signed: false };
  const release = {
    version: "1.2.3",
    publishedAt: null,
    releases: "https://example.com/releases",
    windows,
    mac,
  };
  const platforms = (view: ReturnType<typeof downloadView>) =>
    view.builds.map(({ platform }) => platform);

  it("Windows and the Mac: just their own build", () => {
    expect(downloadView(release, "windows")).toEqual({
      builds: [{ platform: "windows", download: windows }],
      coming: null,
    });
    expect(platforms(downloadView(release, "mac"))).toEqual(["mac"]);
  });

  it("before a computer's own build is out: the others, and that it's coming", () => {
    expect(downloadView({ ...release, mac: null }, "mac")).toEqual({
      builds: [{ platform: "windows", download: windows }],
      coming: "mac",
    });
  });

  it("anywhere else: every build there is", () => {
    for (const device of ["otherComputer", "phoneOrTablet"] as const) {
      expect(downloadView(release, device)).toEqual({
        builds: [
          { platform: "windows", download: windows },
          { platform: "mac", download: mac },
        ],
        coming: null,
      });
      expect(
        platforms(downloadView({ ...release, mac: null }, device)),
      ).toEqual(["windows"]);
    }
  });
});

describe("the release API's reply", () => {
  const release: DesktopRelease = {
    version: "0.2.0",
    publishedAt: "2026-10-01T12:00:00Z",
    releases: "https://example.test/releases",
    windows: {
      url: "https://example.test/FaceOn-Setup.exe",
      size: 90_000_000,
      signed: true,
    },
    mac: null,
  };

  it("reads a release, keeping only what it describes", () => {
    expect(readReleaseReply({ available: true, ...release })).toEqual(release);
    expect(
      readReleaseReply({ available: true, ...release, extra: "kept out" }),
    ).toEqual(release);
  });

  it("is null when there's no release, or the reply isn't one", () => {
    expect(readReleaseReply({ available: false })).toBeNull();
    expect(readReleaseReply(release)).toBeNull();
    expect(readReleaseReply(null)).toBeNull();
    expect(readReleaseReply("release")).toBeNull();
    const reply = { available: true, ...release };
    expect(readReleaseReply({ ...reply, releases: "not a link" })).toBeNull();
    expect(readReleaseReply({ ...reply, version: 2 })).toBeNull();
    expect(readReleaseReply({ ...reply, mac: undefined })).toBeNull();
    for (const windows of [
      { ...release.windows, url: "nowhere" },
      { ...release.windows, size: 0 },
      { ...release.windows, size: 1.5 },
      { ...release.windows, signed: "yes" },
    ]) {
      expect(readReleaseReply({ ...reply, windows })).toBeNull();
    }
  });
});

describe("how a device gets FaceOn as an app", () => {
  const download = {
    url: "https://example.test/FaceOn-Setup.exe",
    size: null,
    signed: false,
  };
  const windowsOnly: DesktopRelease = {
    version: "0.1.0",
    publishedAt: null,
    releases: "https://example.test/releases",
    windows: download,
    mac: null,
  };

  it("offers the desktop app on a Mac or Windows once its build is out", () => {
    const offer = (device: "windows" | "mac") =>
      installOffer({ inApp: false, device, release: windowsOnly });
    expect(offer("windows")).toBe("download");
    // The Mac's build isn't out: the web app's install meanwhile.
    expect(offer("mac")).toBe("web");
    expect(
      installOffer({ inApp: false, device: "windows", release: null }),
    ).toBe("web");
  });

  it("waits for the device and the release, and offers nothing in the app", () => {
    expect(
      installOffer({ inApp: false, device: null, release: windowsOnly }),
    ).toBe("none");
    expect(
      installOffer({ inApp: false, device: "windows", release: undefined }),
    ).toBe("none");
    expect(
      installOffer({ inApp: true, device: "windows", release: windowsOnly }),
    ).toBe("none");
  });

  it("keeps the web app's install for phones, and other computers' in Settings", () => {
    expect(
      installOffer({
        inApp: false,
        device: "phoneOrTablet",
        release: windowsOnly,
      }),
    ).toBe("web");
    expect(
      installOffer({
        inApp: false,
        device: "otherComputer",
        release: windowsOnly,
      }),
    ).toBe("webInSettings");
  });
});

describe("Home's one-time card", () => {
  it("offers the desktop app until the account uses it", () => {
    expect(homeInstallCard("download", false)).toBe("desktop");
    expect(homeInstallCard("download", true)).toBeNull();
  });

  it("is the web app's install on phones, and never both", () => {
    expect(homeInstallCard("web", false)).toBe("web");
    // Using the desktop app doesn't hide a phone's own install.
    expect(homeInstallCard("web", true)).toBe("web");
  });

  it("is nothing where the offer is Settings only, or not known yet", () => {
    expect(homeInstallCard("webInSettings", false)).toBeNull();
    expect(homeInstallCard("none", false)).toBeNull();
  });
});
