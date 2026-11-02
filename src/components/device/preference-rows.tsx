"use client";

import { useTranslations } from "next-intl";

import { SelectRow, SwitchRow } from "@/components/ui/form-fields";
import { NOISE_SUPPRESSION, parseNoiseSuppression } from "@/lib/noise/noise";
import { setPreference, usePreferences, withDefaults } from "@/lib/preferences";

import { useNoiseSuppression } from "./use-noise-suppression";

/**
 * Settings → Audio's choices, also in the meeting's Settings: noise suppression and push
 * to talk. A meeting's microphone follows the noise suppression choice as it changes.
 */
export function AudioPreferenceRows() {
  const t = useTranslations("Settings.audio");
  const { pushToTalk } = withDefaults(usePreferences());
  const noise = useNoiseSuppression();
  const options = NOISE_SUPPRESSION.filter(
    (mode) => mode !== "strong" || noise.strongAvailable,
  ).map((mode) => ({ id: mode, label: t(`noise.${mode}`) }));
  return (
    <>
      <SelectRow
        label={t("noiseSuppression")}
        help={
          noise.chosen === "strong" && !noise.strongAvailable
            ? t("noiseStrongUnavailable")
            : t(`noiseHelp.${noise.mode}`)
        }
        options={options}
        value={noise.mode}
        onChange={(mode) => {
          const choice = parseNoiseSuppression(mode);
          if (choice) setPreference("noiseSuppression", choice);
        }}
      />
      <SwitchRow
        label={t("pushToTalk")}
        help={t("pushToTalkHelp")}
        isSelected={pushToTalk}
        onChange={(on) => setPreference("pushToTalk", on)}
      />
    </>
  );
}

/** Settings → Video's switches, also in the meeting's Settings. */
export function VideoPreferenceRows() {
  const t = useTranslations("Settings.video");
  const { mirrorVideo, hdVideo, cameraOffOnJoin, autoPictureInPicture } =
    withDefaults(usePreferences());
  return (
    <>
      <SwitchRow
        label={t("mirror")}
        help={t("mirrorHelp")}
        isSelected={mirrorVideo}
        onChange={(on) => setPreference("mirrorVideo", on)}
      />
      <SwitchRow
        label={t("hd")}
        help={t("hdHelp")}
        isSelected={hdVideo}
        onChange={(on) => setPreference("hdVideo", on)}
      />
      <SwitchRow
        label={t("offOnJoin")}
        isSelected={cameraOffOnJoin}
        onChange={(on) => setPreference("cameraOffOnJoin", on)}
      />
      <SwitchRow
        label={t("autoPip")}
        help={t("autoPipHelp")}
        isSelected={autoPictureInPicture}
        onChange={(on) => setPreference("autoPictureInPicture", on)}
      />
    </>
  );
}
