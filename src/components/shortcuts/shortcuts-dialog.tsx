"use client";

import dynamic from "next/dynamic";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

import { isAppleDevice, isTypingTarget } from "@/lib/platform";
import { loadPreferences, withDefaults } from "@/lib/preferences";

/**
 * The dialog's code (and the dialog component it's built on) loads the first time it
 * opens, not with every page.
 */
const ShortcutsPanel = dynamic(
  () => import("./shortcuts-panel").then((module) => module.ShortcutsPanel),
  { ssr: false },
);

const OpenShortcutsContext = createContext<() => void>(() => {});

/** Opens the Keyboard shortcuts dialog (from Help, the account menu, a meeting's menus). */
export const useOpenShortcuts = () => use(OpenShortcutsContext);

/**
 * The Keyboard shortcuts dialog, available everywhere: ? or Ctrl/⌘+/ opens it, as in
 * Gmail, Meet and GitHub. Keys show for the person's platform.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept once it has opened, so it can close the way it opened.
  const [wanted, setWanted] = useState(false);

  function show() {
    setWanted(true);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isTypingTarget(event.target)) return;
      const primary = isAppleDevice() ? event.metaKey : event.ctrlKey;
      const question =
        event.key === "?" &&
        !primary &&
        !event.altKey &&
        withDefaults(loadPreferences()).singleKeyShortcuts;
      if (question || (primary && event.key === "/")) {
        event.preventDefault();
        setWanted(true);
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <OpenShortcutsContext value={show}>
      {children}
      {wanted ? <ShortcutsPanel isOpen={open} onOpenChange={setOpen} /> : null}
    </OpenShortcutsContext>
  );
}
