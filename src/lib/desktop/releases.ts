import "server-only";

import { cacheLife } from "next/cache";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

import {
  desktopAssetNames,
  pickInstallers,
  versionFromDownloadUrl,
  type DesktopPlatform,
  type DesktopRelease,
} from "./downloads";

const Release = z.object({
  tag_name: z.string(),
  published_at: z.string().nullable(),
  draft: z.boolean(),
  assets: z.array(
    z.object({
      name: z.string(),
      browser_download_url: z.url(),
      size: z.number(),
    }),
  ),
});

/**
 * The desktop app's latest release, from the releases repository named by
 * DESKTOP_RELEASES_REPO, checked at most about once an hour: each platform's installer,
 * with its size, and whether it's signed (DESKTOP_SIGNED). Null where this copy has
 * none (no repository, or nothing published yet).
 */
export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  const env = serverEnv();
  const repo = env.DESKTOP_RELEASES_REPO;
  if (!repo) return null;
  return releaseIn(
    repo,
    env.DESKTOP_SIGNED ?? "",
    publicEnv.NEXT_PUBLIC_APP_NAME,
  );
}

/**
 * latestDesktopRelease, cached by its settings: the cache outlives deployments, so a new
 * repository or DESKTOP_SIGNED shows with the next deployment rather than up to an hour
 * later.
 */
async function releaseIn(
  repo: string,
  signedPlatforms: string,
  appName: string,
): Promise<DesktopRelease | null> {
  "use cache";
  cacheLife("hours");
  const signed = new Set(signedPlatforms.split(","));
  const names = desktopAssetNames(appName);
  const releases = `https://github.com/${repo}/releases`;

  const release = await askGitHub(repo);
  if (release === "none") return null;
  if (release) {
    const found = pickInstallers(release.assets, names);
    const download = (platform: DesktopPlatform) => {
      const file = found[platform];
      return file
        ? {
            url: file.browser_download_url,
            size: file.size > 0 ? file.size : null,
            signed: signed.has(platform),
          }
        : null;
    };
    const windows = download("windows");
    const mac = download("mac");
    if (!windows && !mac) return null;
    return {
      version: release.tag_name.replace(/^v/, ""),
      publishedAt: release.published_at,
      releases,
      windows,
      mac,
    };
  }

  // GitHub's API couldn't say (it limits how often a server may ask): the installers'
  // fixed names still lead to the latest release's.
  const [windows, mac] = await Promise.all([
    latestFile(repo, names.windows),
    latestFile(repo, names.mac),
  ]);
  if (!windows && !mac) return null;
  const download = (platform: DesktopPlatform, file: typeof windows) =>
    file ? { url: file.url, size: null, signed: signed.has(platform) } : null;
  return {
    version: windows?.version ?? mac?.version ?? null,
    publishedAt: null,
    releases,
    windows: download("windows", windows),
    mac: download("mac", mac),
  };
}

/** The latest release, from GitHub's API: "none" when there isn't one, null when it can't say. */
async function askGitHub(
  repo: string,
): Promise<z.infer<typeof Release> | "none" | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "faceon-download-page",
        },
      },
    );
    if (response.status === 404) return "none";
    if (!response.ok) return null;
    const parsed = Release.safeParse(await response.json());
    if (!parsed.success) return null;
    return parsed.data.draft ? "none" : parsed.data;
  } catch {
    return null;
  }
}

/** A file of the latest release by its fixed name, without the API, and the version on the way. */
async function latestFile(
  repo: string,
  name: string,
): Promise<{ url: string; version: string | null } | null> {
  const url = `https://github.com/${repo}/releases/latest/download/${name}`;
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "manual" });
    const location = response.headers.get("location");
    return response.status >= 300 && response.status < 400 && location
      ? { url, version: versionFromDownloadUrl(location) }
      : null;
  } catch {
    return null;
  }
}
