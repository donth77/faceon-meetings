"use client";

import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { MicMeter } from "@/components/meeting/pre-join/mic-meter";
import { useLocalTrack } from "@/components/meeting/pre-join/use-local-track";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/form-fields";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { playTestSound } from "@/lib/device/test-sound";
import {
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import {
  canChooseSpeaker,
  DeviceField,
  DeviceProblemNote,
  useRememberedDevices,
} from "./device-fields";
import { SectionTitle, SettingsCard } from "./settings-nav";

/** Settings → Audio: microphone with a level meter, speaker with a test, noise suppression. */
export function AudioSettings() {
  const t = useTranslations("Settings.audio");
  const [devices, update] = useRememberedDevices();
  const { noiseSuppression, pushToTalk } = withDefaults(usePreferences());
  const mic = useLocalTrack("audio", true, devices.micId, noiseSuppression);
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
            <MicMeter track={mic.track} />
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
          <SwitchRow
            label={t("noiseSuppression")}
            help={t("noiseSuppressionHelp")}
            isSelected={noiseSuppression}
            onChange={(on) =>
              savePreferences({ noiseSuppression: on ? undefined : false })
            }
          />
          <SwitchRow
            label={t("pushToTalk")}
            help={t("pushToTalkHelp")}
            isSelected={pushToTalk}
            onChange={(on) =>
              savePreferences({ pushToTalk: on ? true : undefined })
            }
          />
        </div>
      </SettingsCard>
    </>
  );
}
