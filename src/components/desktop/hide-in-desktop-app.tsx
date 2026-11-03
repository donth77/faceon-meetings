"use client";

import type { ReactNode } from "react";

import { useDesktop } from "@/lib/desktop/use-desktop";

/**
 * What the website shows but the desktop app does without: its first screen already
 * offers joining, and its window has no room for the website's footer.
 */
export function HideInDesktopApp({ children }: { children: ReactNode }) {
  return useDesktop() ? null : children;
}
