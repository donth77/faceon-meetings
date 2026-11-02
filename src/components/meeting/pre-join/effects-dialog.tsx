"use client";

import { useTranslations } from "next-intl";

import { EffectsChooser } from "@/components/effects/effects-chooser";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import type { Effect } from "@/lib/effects/effects";
import { setPreference } from "@/lib/preferences";

/**
 * Backgrounds and effects before joining, from the preview's button, so you can pick
 * one before anyone sees you. The choice is kept, and the meeting starts with it.
 */
export function EffectsDialog({
  isOpen,
  onClose,
  track,
  cameraOn,
  mirror,
  value,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The preview with the effect (null while it starts, or with the camera off). */
  track: MediaStreamTrack | null;
  cameraOn: boolean;
  mirror: boolean;
  value: Effect | null;
}) {
  const t = useTranslations("Effects");
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeLabel={t("close")}
      className="max-h-[calc(100dvh-2rem)] w-[min(1040px,calc(100vw-2rem))] max-w-none p-0 max-md:h-dvh max-md:max-h-dvh max-md:w-screen max-md:rounded-none sm:max-w-none"
      bodyClassName="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-6"
    >
      <DialogTitle className="pr-10 text-lg font-bold">
        {t("title")}
      </DialogTitle>
      <EffectsChooser
        track={track}
        mirror={mirror}
        cameraOn={cameraOn}
        value={value}
        onChange={(next) => setPreference("effect", next)}
        layout="split"
      />
    </Dialog>
  );
}
