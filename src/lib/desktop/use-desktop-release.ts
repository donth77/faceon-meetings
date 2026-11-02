"use client";

import { useEffect, useState } from "react";

export type DesktopReleaseInfo = {
  version: string;
  mac: string | null;
  windows: string | null;
};

let request: Promise<DesktopReleaseInfo | null> | null = null;

function loadRelease(): Promise<DesktopReleaseInfo | null> {
  request ??= fetch("/api/desktop/release")
    .then((response) => (response.ok ? response.json() : null))
    .then((body: unknown) => {
      if (!body || typeof body !== "object" || !("available" in body)) {
        return null;
      }
      const release = body as { available: boolean } & DesktopReleaseInfo;
      return release.available
        ? {
            version: release.version,
            mac: release.mac,
            windows: release.windows,
          }
        : null;
    })
    .catch(() => null);
  return request;
}

/**
 * The desktop app's latest release: undefined while finding out, null where this copy
 * has none yet. Asked once per page load.
 */
export function useDesktopRelease(): DesktopReleaseInfo | null | undefined {
  const [release, setRelease] = useState<DesktopReleaseInfo | null | undefined>(
    undefined,
  );
  useEffect(() => {
    let current = true;
    void loadRelease().then((found) => {
      if (current) setRelease(found);
    });
    return () => {
      current = false;
    };
  }, []);
  return release;
}
