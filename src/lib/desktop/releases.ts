import "server-only";

import { cacheLife } from "next/cache";
import { z } from "zod";

import { serverEnv } from "@/lib/server-env";

const Release = z.object({
  tag_name: z.string(),
  published_at: z.string().nullable(),
  html_url: z.url(),
  draft: z.boolean(),
  assets: z.array(
    z.object({ name: z.string(), browser_download_url: z.url() }),
  ),
});

export type DesktopRelease = {
  version: string;
  publishedAt: string | null;
  /** The release's page, with every file. */
  page: string;
  /** The universal .dmg. */
  mac: string | null;
  /** The installer, for x64 and Arm64. */
  windows: string | null;
};

/**
 * The desktop app's latest release, from the releases repository named by
 * DESKTOP_RELEASES_REPO, checked at most about once an hour. Null where this copy has
 * none (no repository, or nothing published yet).
 */
export async function latestDesktopRelease(): Promise<DesktopRelease | null> {
  "use cache";
  cacheLife("hours");
  const repo = serverEnv().DESKTOP_RELEASES_REPO;
  if (!repo) return null;
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
    if (!response.ok) return null;
    const parsed = Release.safeParse(await response.json());
    if (!parsed.success || parsed.data.draft) return null;
    const file = (ending: string) =>
      parsed.data.assets.find((asset) =>
        asset.name.toLowerCase().endsWith(ending),
      )?.browser_download_url ?? null;
    return {
      version: parsed.data.tag_name.replace(/^v/, ""),
      publishedAt: parsed.data.published_at,
      page: parsed.data.html_url,
      mac: file(".dmg"),
      windows: file(".exe"),
    };
  } catch {
    return null;
  }
}
