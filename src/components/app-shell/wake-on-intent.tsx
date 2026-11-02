"use client";

import { useEffect } from "react";

/** A wake keeps a sleeping database up for its idle window: once per tab in that time. */
const WAKE_EVERY_MS = 4 * 60 * 1000;
const STORAGE_KEY = "faceon.wokeAt";

function lastWake(): number {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function wake() {
  if (Date.now() - lastWake() < WAKE_EVERY_MS) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Without storage, at most once per page load.
  }
  void fetch("/api/wake", { method: "POST", keepalive: true }).catch(() => {});
}

/**
 * On pages where someone is about to need the database (the landing page's meeting ID
 * field, sign-in and sign-up), the first sign of intent (a focus, a tap or a key) wakes
 * it, so a sleeping database (lib/db/wake-rule.ts) is ready by the time they submit.
 * Rendered only where the database sleeps; loading a page alone never wakes it, so
 * crawlers can't keep it awake.
 */
export function WakeOnIntent() {
  useEffect(() => {
    let done = false;
    const onIntent = () => {
      if (done) return;
      done = true;
      wake();
      for (const type of EVENTS) document.removeEventListener(type, onIntent);
    };
    for (const type of EVENTS) {
      document.addEventListener(type, onIntent, { passive: true });
    }
    return () => {
      for (const type of EVENTS) document.removeEventListener(type, onIntent);
    };
  }, []);
  return null;
}

const EVENTS = ["focusin", "pointerdown", "keydown"] as const;
