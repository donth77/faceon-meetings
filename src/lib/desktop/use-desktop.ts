"use client";

import { useSyncExternalStore } from "react";

import { BRIDGE_VERSION, type FaceonDesktop } from "./bridge";
import { isComputer } from "./open-in-app";

const subscribeNever = () => () => {};

/** The desktop app's bridge where this page runs inside it and speaks this version. */
export function desktopBridge(): FaceonDesktop | null {
  if (typeof window === "undefined") return null;
  const bridge = window.faceonDesktop;
  return bridge && bridge.bridge === BRIDGE_VERSION ? bridge : null;
}

/** Whether this page runs inside the FaceOn desktop app. */
export const isDesktopApp = () => desktopBridge() !== null;

/**
 * The desktop app's bridge, or null in a browser. The cached app shell is the same for
 * everyone, so this is decided in the browser after hydration: the server and the first
 * render say null, and nothing desktop-only is ever rendered on the server.
 */
export function useDesktop(): FaceonDesktop | null {
  return useSyncExternalStore(subscribeNever, desktopBridge, () => null);
}

/** A computer rather than a phone or tablet, decided after hydration (false on the server). */
export function useIsComputer(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => isComputer(navigator.userAgent, navigator.maxTouchPoints),
    () => false,
  );
}
