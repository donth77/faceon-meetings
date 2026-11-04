"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ShortcutsList } from "./shortcuts-list";

/** The Keyboard shortcuts dialog itself, loaded the first time it opens. */
export function ShortcutsPanel({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Shortcuts");
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
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
  );
}
