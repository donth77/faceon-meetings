"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  deviceKind,
  readReleaseReply,
  type DesktopDownload,
  type DesktopPlatform,
  type DesktopRelease,
  type DeviceKind,
} from "./downloads";
import { useDesktop } from "./use-desktop";

let request: Promise<DesktopRelease | null> | null = null;

function loadRelease(): Promise<DesktopRelease | null> {
  request ??= fetch("/api/desktop/release")
    .then((response) => (response.ok ? response.json() : null))
    .then(readReleaseReply)
    .catch(() => null);
  return request;
}

/**
 * The desktop app's latest release: undefined while finding out (or not asked), null
 * where this copy has none yet. Asked once per page load, only when `wanted`.
 */
export function useDesktopRelease(
  wanted = true,
): DesktopRelease | null | undefined {
  const [release, setRelease] = useState<DesktopRelease | null | undefined>(
    undefined,
  );
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    void loadRelease().then((found) => {
      if (current) setRelease(found);
    });
    return () => {
      current = false;
    };
  }, [wanted]);
  return release;
}

const subscribeNever = () => () => {};

/**
 * What this browser runs on (lib/desktop/downloads.ts), once the page runs here: null
 * before, since the cached page is the same for everyone.
 */
export function useDeviceKind(): DeviceKind | null {
  return useSyncExternalStore(
    subscribeNever,
    () => deviceKind(navigator.userAgent, navigator.maxTouchPoints),
    () => null,
  );
}

/**
 * This computer's download: on a Mac or Windows, outside the desktop app, once its
 * build is out (Windows may come before the Mac). Null otherwise.
 */
export function useDesktopDownload(): {
  platform: DesktopPlatform;
  download: DesktopDownload;
  release: DesktopRelease;
} | null {
  const inApp = useDesktop() !== null;
  const device = useDeviceKind();
  const platform = device === "windows" || device === "mac" ? device : null;
  const release = useDesktopRelease(platform !== null && !inApp);
  if (inApp || !platform || !release) return null;
  const download = release[platform];
  return download ? { platform, download, release } : null;
}
