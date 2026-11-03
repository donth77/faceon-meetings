import { z } from "zod";

/**
 * The desktop app's downloads, shared by the server (lib/desktop/releases.ts) and the
 * pages that offer them: which computer this is, each platform's installer in a release,
 * and its size.
 */

/** The computers the desktop app is built for. */
export const DESKTOP_PLATFORMS = ["windows", "mac"] as const;
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number];

const DesktopDownloadSchema = z.object({
  url: z.url(),
  /** Bytes, when GitHub said. */
  size: z.number().int().positive().nullable(),
  /** Signed (Windows) or notarized (Mac): DESKTOP_SIGNED. */
  signed: z.boolean(),
});
export type DesktopDownload = z.infer<typeof DesktopDownloadSchema>;

export const DesktopReleaseSchema = z.object({
  /** Null when GitHub's API couldn't be asked and the release's files didn't say. */
  version: z.string().nullable(),
  publishedAt: z.string().nullable(),
  /** Every release, with all their files. */
  releases: z.url(),
  windows: DesktopDownloadSchema.nullable(),
  mac: DesktopDownloadSchema.nullable(),
});
export type DesktopRelease = z.infer<typeof DesktopReleaseSchema>;

/**
 * What this browser runs on, from its user agent: a Mac or Windows (the desktop app's),
 * another computer (Linux, ChromeOS), or a phone or tablet. An iPad says it's a Mac,
 * but has a touch screen.
 */
export type DeviceKind = DesktopPlatform | "otherComputer" | "phoneOrTablet";

export function deviceKind(
  userAgent: string,
  maxTouchPoints: number,
): DeviceKind {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent))
    return "phoneOrTablet";
  if (/Windows/.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/.test(userAgent)) {
    return maxTouchPoints > 1 ? "phoneOrTablet" : "mac";
  }
  return "otherComputer";
}

/**
 * How a device gets FaceOn as an app: the desktop app's download on a Mac or Windows once
 * its build is out, the web app's install on phones and tablets (and on a Mac or Windows
 * until then), the web app's install in Settings only on other computers, and nothing
 * inside the desktop app or before the device and the release are known.
 */
export type InstallOffer = "none" | "download" | "web" | "webInSettings";

export function installOffer(input: {
  inApp: boolean;
  device: DeviceKind | null;
  /** The latest release: undefined while finding out, null where there's none. */
  release: DesktopRelease | null | undefined;
}): InstallOffer {
  const { inApp, device, release } = input;
  if (inApp || device === null) return "none";
  if (device === "phoneOrTablet") return "web";
  if (device === "otherComputer") return "webInSettings";
  if (release === undefined) return "none";
  return release?.[device] ? "download" : "web";
}

/**
 * Home's one-time card, never two: the desktop app's where it's offered, unless this
 * account uses the app already; or the web app's install. None where the offer is
 * Settings only.
 */
export function homeInstallCard(
  offer: InstallOffer,
  desktopAppUsed: boolean,
): "desktop" | "web" | null {
  if (offer === "download") return desktopAppUsed ? null : "desktop";
  return offer === "web" ? "web" : null;
}

/** What /download offers a device (downloadView). */
export type DownloadView = {
  /** The builds, in order. */
  builds: { platform: DesktopPlatform; download: DesktopDownload }[];
  /** This computer's platform, when its build isn't out yet. */
  coming: DesktopPlatform | null;
};

/**
 * What /download offers a device: on Windows or a Mac just its own build, as other apps'
 * download pages do; anywhere else every build. Until a computer's own build is out
 * (Windows can come before the Mac), the ones that are, and which is coming.
 */
export function downloadView(
  release: DesktopRelease,
  device: DeviceKind,
): DownloadView {
  const builds = DESKTOP_PLATFORMS.flatMap((platform) => {
    const download = release[platform];
    return download ? [{ platform, download }] : [];
  });
  if (device !== "windows" && device !== "mac") return { builds, coming: null };
  const own = builds.filter(({ platform }) => platform === device);
  return own.length > 0
    ? { builds: own, coming: null }
    : { builds, coming: device };
}

/**
 * The installers' file names, the same in every release (desktop/electron-builder
 * .config.cjs names them so), so releases/latest/download/<name> always finds the latest.
 */
export function desktopAssetNames(
  appName: string,
): Record<DesktopPlatform, string> {
  const base =
    appName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "FaceOn";
  return { windows: `${base}-Setup.exe`, mac: `${base}.dmg` };
}

type Asset = { name: string; browser_download_url: string; size: number };

/**
 * Each platform's installer among a release's files: by its usual name, else the
 * Windows installer (.exe) and the Mac's universal disk image (.dmg).
 */
export function pickInstallers<File extends Asset>(
  files: File[],
  names: Record<DesktopPlatform, string>,
): Record<DesktopPlatform, File | null> {
  const named = (name: string) =>
    files.find((file) => file.name.toLowerCase() === name.toLowerCase());
  const images = files.filter((file) => /\.dmg$/i.test(file.name));
  return {
    windows:
      named(names.windows) ??
      files.find((file) => /\.exe$/i.test(file.name)) ??
      null,
    mac:
      named(names.mac) ??
      images.find((file) => /universal/i.test(file.name)) ??
      (images.length === 1 ? images[0] : null) ??
      null,
  };
}

/** The version in a release file's address (…/releases/download/v1.2.3/…). */
export function versionFromDownloadUrl(url: string): string | null {
  return /\/releases\/download\/v?([^/]+)\//.exec(url)?.[1] ?? null;
}

/** A file's size as people read it: "68 MB". */
export function formatSize(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 0,
  }).format(Math.max(1, Math.round(bytes / 1_048_576)));
}
