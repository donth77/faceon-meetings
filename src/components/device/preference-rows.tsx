"use client";

import { useTranslations } from "next-intl";

import { SwitchRow } from "@/components/ui/form-fields";
import { setPreference, usePreferences, withDefaults } from "@/lib/preferences";

/**
 * Settings → Audio's switches, also in the meeting's Settings: noise suppression and
 * push to talk. `onNoiseSuppression` applies the change to a live microphone too.
 */
export function AudioPreferenceRows({
  onNoiseSuppression,
}: {
  onNoiseSuppression?: (on: boolean) => void;
}) {
  const t = useTranslations("Settings.audio");
  const { noiseSuppression, pushToTalk } = withDefaults(usePreferences());
  return (
    <>
      <SwitchRow
        label={t("noiseSuppression")}
        help={t("noiseSuppressionHelp")}
        isSelected={noiseSuppression}
        onChange={(on) => {
          setPreference("noiseSuppression", on);
          onNoiseSuppression?.(on);
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
