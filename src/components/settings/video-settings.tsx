"use client";

import { cn } from "cn";
import { LoaderCircle, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { useLocalTrack } from "@/components/meeting/pre-join/use-local-track";
import { SwitchRow } from "@/components/schedule/fields";
import { useMediaDevices } from "@/hooks/use-media-devices";
import {
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import {
  DeviceField,
  DeviceProblemNote,
  useRememberedDevices,
} from "./device-fields";
import { SettingsCard } from "./settings-nav";

function Preview({
  track,
  mirror,
}: {
  track: MediaStreamTrack;
  mirror: boolean;
}) {
  const attach = useCallback(
    (node: HTMLVideoElement | null) => {
      if (node) node.srcObject = new MediaStream([track]);
    },
    [track],
  );
  return (
    <video
      ref={attach}
      autoPlay
      playsInline
      muted
      className={cn(
        "absolute inset-0 size-full object-cover",
        mirror && "-scale-x-100",
      )}
    />
  );
}

/** Settings → Video: a camera preview, the camera, mirroring, HD and starting with it off. */
export function VideoSettings() {
  const t = useTranslations("Settings.video");
  const tp = useTranslations("PreJoin");
  const [devices, update] = useRememberedDevices();
  const { mirrorVideo, hdVideo, cameraOffOnJoin } =
    withDefaults(usePreferences());
  const camera = useLocalTrack("video", true, devices.cameraId);
  const lists = useMediaDevices(camera.track?.id ?? "");

  return (
    <>
      <h2 className="text-[22px] font-bold">{t("title")}</h2>
      <SettingsCard title={t("camera")}>
        <div className="flex flex-wrap items-start gap-5">
          <div
            role="img"
            aria-label={t("preview")}
            className="relative aspect-video w-[400px] max-w-full flex-none overflow-hidden rounded-xl bg-[#1a1f26] text-[#c9d0d8]"
          >
            {camera.track ? (
              <Preview track={camera.track} mirror={mirrorVideo} />
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
            <p className="text-muted-foreground text-sm leading-normal">
              {t("othersSee")}
            </p>
          </div>
        </div>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          <SwitchRow
            label={t("mirror")}
            help={t("mirrorHelp")}
            isSelected={mirrorVideo}
            onChange={(on) =>
              savePreferences({ mirrorVideo: on ? undefined : false })
            }
          />
          <SwitchRow
            label={t("hd")}
            help={t("hdHelp")}
            isSelected={hdVideo}
            onChange={(on) =>
              savePreferences({ hdVideo: on ? undefined : false })
            }
          />
          <SwitchRow
            label={t("offOnJoin")}
            isSelected={cameraOffOnJoin}
            onChange={(on) =>
              savePreferences({ cameraOffOnJoin: on ? true : undefined })
            }
          />
        </div>
      </SettingsCard>
    </>
  );
}
