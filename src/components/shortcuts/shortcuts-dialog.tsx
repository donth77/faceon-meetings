"use client";

import { useTranslations } from "next-intl";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isAppleDevice, isTypingTarget } from "@/lib/platform";
import { loadPreferences, withDefaults } from "@/lib/preferences";

import { ShortcutsList } from "./shortcuts-list";

const OpenShortcutsContext = createContext<() => void>(() => {});

/** Opens the Keyboard shortcuts dialog (from Help, the account menu, a meeting's menus). */
export const useOpenShortcuts = () => use(OpenShortcutsContext);

/**
 * The Keyboard shortcuts dialog, available everywhere: ? or Ctrl/⌘+/ opens it, as in
 * Gmail, Meet and GitHub. Keys show for the person's platform.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Shortcuts");
  const [open, setOpen] = useState(false);

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
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <OpenShortcutsContext value={() => setOpen(true)}>
      {children}
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        className="sm:max-w-lg"
        closeLabel={t("close")}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <ShortcutsList />
      </Dialog>
    </OpenShortcutsContext>
  );
}
