"use client";

import { LoaderCircle, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { DeviceProblemNote } from "@/components/device/device-problem-note";
import { MirroredVideo } from "@/components/device/mirrored-video";
import { VideoPreferenceRows } from "@/components/device/preference-rows";
import { useLocalTrack } from "@/components/device/use-local-track";
import { useMediaDevices } from "@/hooks/use-media-devices";
import { usePreferences, withDefaults } from "@/lib/preferences";

import { DeviceField, useRememberedDevices } from "./device-fields";
import { SectionTitle, SettingsCard } from "./settings-nav";

/** Settings → Video: a camera preview, the camera, mirroring, HD and starting with it off. */
export function VideoSettings() {
  const t = useTranslations("Settings.video");
  const tp = useTranslations("PreJoin");
  const [devices, update] = useRememberedDevices();
  const { mirrorVideo } = withDefaults(usePreferences());
  const camera = useLocalTrack("video", true, devices.cameraId);
  const lists = useMediaDevices(camera.track?.id ?? "");

  return (
    <>
      <SectionTitle title={t("title")} />
      <SettingsCard title={t("camera")}>
        <div className="flex flex-wrap items-start gap-5">
          <div
            role="img"
            aria-label={t("preview")}
            className="relative aspect-video w-[400px] max-w-full flex-none overflow-hidden rounded-xl bg-[#1a1f26] text-[#c9d0d8]"
          >
            {camera.track ? (
              <MirroredVideo track={camera.track} mirror={mirrorVideo} />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm">
                {camera.pending ? (
                  <LoaderCircle
                    className="size-6 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <VideoOff className="size-6" aria-hidden="true" />
                )}
                {camera.pending ? tp("startingCamera") : tp("cameraOff")}
              </span>
            )}
            {camera.track && mirrorVideo ? (
              <span className="absolute top-2.5 right-2.5 rounded-[10px] bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                {t("mirroredForYou")}
              </span>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3.5">
            <div className="max-w-[440px]">
              <DeviceField
                label={t("camera")}
                devices={lists.cameras}
                value={devices.cameraId}
                activeId={camera.track?.getSettings().deviceId}
                onChange={(cameraId) => update({ cameraId })}
              />
            </div>
            {camera.problem ? (
              <DeviceProblemNote
                device="camera"
                problem={camera.problem}
                onRetry={camera.retry}
              />
            ) : null}
          </div>
        </div>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          <VideoPreferenceRows />
        </div>
      </SettingsCard>
    </>
  );
}
