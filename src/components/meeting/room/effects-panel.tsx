"use client";

import { useTranslations } from "next-intl";

import { EffectsChooser } from "@/components/effects/effects-chooser";
import {
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { useRoomMedia } from "../media";
import { SidePanel } from "./side-panel";

/**
 * Backgrounds and effects in a meeting, from the camera menu: your camera as others see
 * it, and the choices. A change applies to the call at once (see room-effects.tsx).
 */
export function EffectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("Effects");
  const { camera } = useRoomMedia();
  const { mirrorVideo, effect } = withDefaults(usePreferences());

  return (
    <SidePanel title={t("title")} closeLabel={t("close")} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5">
        <EffectsChooser
          track={camera.track}
          mirror={mirrorVideo}
          cameraOn={camera.enabled}
          value={effect}
          onChange={(next) => savePreferences({ effect: next ?? undefined })}
        />
      </div>
    </SidePanel>
  );
}
