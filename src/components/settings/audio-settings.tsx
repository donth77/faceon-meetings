"use client";

import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DeviceProblemNote } from "@/components/device/device-problem-note";
import { MicMeter } from "@/components/device/mic-meter";
import { AudioPreferenceRows } from "@/components/device/preference-rows";
import { useLocalTrack } from "@/components/device/use-local-track";
import { useNoiseSuppression } from "@/components/device/use-noise-suppression";
import { useNoiseTrack } from "@/components/device/use-noise-track";
import { Button } from "@/components/ui/button";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { playTestSound } from "@/lib/device/test-sound";
import { browserSuppression } from "@/lib/noise/noise";
import { canChooseSpeaker } from "@/lib/platform";

import { DeviceField, useRememberedDevices } from "./device-fields";
import { SectionTitle, SettingsCard } from "./settings-nav";

/** Settings → Audio: microphone with a level meter, speaker with a test, noise suppression. */
export function AudioSettings() {
  const t = useTranslations("Settings.audio");
  const [devices, update] = useRememberedDevices();
  const noise = useNoiseSuppression();
  const mic = useLocalTrack(
    "audio",
    true,
    devices.micId,
    browserSuppression(noise.mode),
  );
  // The meter shows what others would hear, with strong suppression when it's on.
  const heard = useNoiseTrack(mic.track, noise.mode);
  const lists = useMediaDevices(mic.track?.id ?? "");
  const chooseSpeaker = canChooseSpeaker() && lists.speakers.length > 0;

  return (
    <>
      <SectionTitle title={t("title")} />
      <SettingsCard title={t("devices")}>
        <div className="flex max-w-[440px] flex-col gap-3.5">
          <DeviceField
            label={t("microphone")}
            devices={lists.microphones}
            value={devices.micId}
            activeId={mic.track?.getSettings().deviceId}
            onChange={(micId) => update({ micId })}
          />
          {mic.problem ? (
            <DeviceProblemNote
              device="microphone"
              problem={mic.problem}
              onRetry={mic.retry}
            />
          ) : (
            <MicMeter track={heard} />
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          {chooseSpeaker ? (
            <div className="min-w-0 flex-[1_1_320px] sm:max-w-[440px]">
              <DeviceField
                label={t("speaker")}
                devices={lists.speakers}
                value={devices.speakerId}
                onChange={(speakerId) => update({ speakerId })}
              />
            </div>
          ) : null}
          <Button
            variant="outline"
            className="h-11 gap-2 rounded-[10px] px-4 text-sm font-semibold"
            onPress={() =>
              void playTestSound(devices.speakerId).catch(() => {})
            }
          >
            <Volume2 className="size-[18px]" aria-hidden="true" />
            {t("testSpeaker")}
          </Button>
        </div>
        {chooseSpeaker ? null : (
          <p className="text-muted-foreground -mt-1 text-[13px]">
            {t("speakerFixed")}
          </p>
        )}
        <div className="divide-y divide-[#e2e5ea] border-t border-[#e2e5ea] dark:divide-white/10 dark:border-white/10">
          <AudioPreferenceRows />
        </div>
      </SettingsCard>
    </>
  );
}
