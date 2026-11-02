"use client";

import { useSyncExternalStore } from "react";

import { usePreferences } from "@/lib/preferences";
import { isTimeZone, systemTimeZone } from "@/lib/time";

const subscribeNever = () => () => {};

/**
 * The viewer's time zone (Settings → General, else the device's), following changes.
 * "UTC" while server rendering and hydrating, since the server can't know it; the
 * real zone follows straight after.
 */
export function useViewerTimeZone(): string {
  const { timeZone } = usePreferences();
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  if (!hydrated) return "UTC";
  return isTimeZone(timeZone) ? timeZone : systemTimeZone();
}
