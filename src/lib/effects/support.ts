import { supports } from "@/lib/capabilities";

import { runnableEffect, type Effect } from "./effects";

/**
 * The saved effect if it can run on this device, otherwise null (no effect): backgrounds
 * and effects need the browser's support, and motion backgrounds their footage's format
 * (lib/capabilities.ts). Slow devices are caught later, frame by frame.
 */
export const availableEffect = (effect: Effect | null) =>
  runnableEffect(effect, {
    effects: supports("effects"),
    footage: supports("motionBackgrounds"),
  });
