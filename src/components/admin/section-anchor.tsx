"use client";

import { useEffect } from "react";

/**
 * Emails link to sections of Settings → Admin (#usage, #permissions). The page streams in
 * behind its loading state, after the browser has looked for the anchor, so this goes to
 * the section once it's on screen.
 */
export function SectionAnchor({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ block: "start" }),
    );
  }, [id]);
  return null;
}
