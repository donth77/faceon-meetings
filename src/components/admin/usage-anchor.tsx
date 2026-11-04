"use client";

import { useEffect } from "react";

/**
 * Usage warnings link to #usage, the last section of Settings → Admin. The page streams
 * in behind its loading state, after the browser has looked for the anchor, so this goes
 * to the section once it's on screen.
 */
export function UsageAnchor() {
  useEffect(() => {
    if (window.location.hash !== "#usage") return;
    requestAnimationFrame(() =>
      document.getElementById("usage")?.scrollIntoView({ block: "start" }),
    );
  }, []);
  return null;
}
