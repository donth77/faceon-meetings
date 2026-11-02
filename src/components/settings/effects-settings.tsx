"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EffectsChooser } from "@/components/effects/effects-chooser";
import { useEffectProblems } from "@/components/effects/use-effect-problems";
import { useEffectsTrack } from "@/components/effects/use-effects-track";
import { useLocalTrack } from "@/components/meeting/pre-join/use-local-track";
import { effectsSupported } from "@/lib/effects/support";
import {
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { DeviceProblemNote, useRememberedDevices } from "./device-fields";
import { SectionTitle, SettingsCard } from "./settings-nav";

/**
 * Settings → Backgrounds and effects: the background on your camera in every meeting
 * on this device, with a live preview.
 */
export function EffectsSettings() {
  const t = useTranslations("Settings.effects");
  const te = useTranslations("Effects");
  const [devices] = useRememberedDevices();
  const { mirrorVideo, effect } = withDefaults(usePreferences());
  const [supported] = useState(effectsSupported);
  const camera = useLocalTrack("video", supported, devices.cameraId);
  const preview = useEffectsTrack(camera.track, effect, useEffectProblems());

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      <SettingsCard title={te("choices")}>
        {supported ? (
          <>
            <EffectsChooser
              track={preview}
              mirror={mirrorVideo}
              cameraOn={camera.track !== null || camera.pending}
              value={effect}
              onChange={(next) =>
                savePreferences({ effect: next ?? undefined })
              }
              layout="split"
            />
            {camera.problem ? (
              <DeviceProblemNote
                device="camera"
                problem={camera.problem}
                onRetry={camera.retry}
              />
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{te("unsupported")}</p>
        )}
      </SettingsCard>
    </>
  );
}
