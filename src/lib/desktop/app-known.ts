"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this browser knows the desktop app is on this computer: it finished signing
 * the app in (/desktop/sign-in). Browsers can't tell otherwise, so one that doesn't know
 * never tries to open the app by itself.
 */
const KEY = "faceon.desktopApp";
const CHANGED = "faceon:desktop-app";

export function markDesktopAppKnown() {
  try {
    localStorage.setItem(KEY, String(Date.now()));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    // Storage blocked: the browser just won't know.
  }
}

export function desktopAppKnown(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

export const useDesktopAppKnown = () =>
  useSyncExternalStore(subscribe, desktopAppKnown, () => false);
