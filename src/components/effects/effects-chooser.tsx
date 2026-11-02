"use client";

import { cn } from "cn";
import { LoaderCircle, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { MirroredVideo } from "@/components/device/mirrored-video";
import {
  MOTIONS,
  STILLS,
  type BackgroundLicense,
  type Effect,
} from "@/lib/effects/effects";

import { EffectsPicker } from "./effects-picker";
import { useUploads, type ShownUpload } from "./use-uploads";

/** What the chosen effect is called, and where it's from. */
function useCaption(effect: Effect | null, uploads: ShownUpload[]) {
  const t = useTranslations("Effects");
  const credit = (source?: { by: string; license: BackgroundLicense }) =>
    source
      ? t("credit", { by: source.by, license: t(`license.${source.license}`) })
      : undefined;
  if (!effect) return { name: t("none") };
  switch (effect.kind) {
    case "blur":
      return { name: t(`blur.${effect.level}`) };
    case "still":
      return {
        name: t(`stills.${effect.id}`),
        detail: credit(STILLS.find((entry) => entry.id === effect.id)),
      };
    case "motion":
      return {
        name: t(`motion.${effect.id}`),
        detail: credit(MOTIONS.find((entry) => entry.id === effect.id)),
      };
    case "upload": {
      const upload = uploads.find((entry) => entry.id === effect.id);
      return {
        name: upload
          ? t(upload.kind === "image" ? "uploadImage" : "uploadVideo", {
              n: upload.number,
            })
          : t("groups.yours"),
      };
    }
  }
}

/**
 * Backgrounds and effects with a live preview of your camera: in the meeting's panel,
 * on pre-join and in Settings. The choice applies at once and is kept on this device.
 */
export function EffectsChooser({
  track,
  mirror,
  cameraOn,
  value,
  onChange,
  layout = "stack",
}: {
  /** Your camera with the effect; null while it starts, or with the camera off. */
  track: MediaStreamTrack | null;
  mirror: boolean;
  cameraOn: boolean;
  value: Effect | null;
  onChange: (effect: Effect | null) => void;
  /** "split" puts the preview beside the choices where there's room. */
  layout?: "stack" | "split";
}) {
  const t = useTranslations("Effects");
  const uploads = useUploads();
  const caption = useCaption(value, uploads);

  // Side by side only where the space itself is wide (a container query), so the
  // choices never get squeezed into two columns.
  return (
    <div className="@container min-w-0">
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          layout === "split" && "@3xl:flex-row @3xl:items-start @3xl:gap-6",
        )}
      >
        <div
          className={cn(
            "flex w-full max-w-[480px] min-w-0 flex-col gap-2",
            layout === "split" &&
              "@3xl:sticky @3xl:top-0 @3xl:w-[400px] @3xl:shrink-0",
          )}
        >
          <div
            role="img"
            aria-label={t("preview")}
            className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#0e1013] text-[#c9d0d8]"
          >
            {track ? (
              <MirroredVideo track={track} mirror={mirror} />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
                {cameraOn ? (
                  <>
                    <LoaderCircle
                      className="size-6 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    {t("starting")}
                  </>
                ) : (
                  <>
                    <VideoOff className="size-6" aria-hidden="true" />
                    {t("cameraOff")}
                  </>
                )}
              </span>
            )}
            {track && mirror ? (
              <span className="absolute top-2.5 right-2.5 rounded-[10px] bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                {t("mirrored")}
              </span>
            ) : null}
          </div>
          <p className="min-w-0 text-sm">
            <span className="font-semibold">{caption.name}</span>
            {caption.detail ? (
              <span className="text-muted-foreground"> · {caption.detail}</span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-xs leading-normal">
            {t("private")}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <EffectsPicker value={value} uploads={uploads} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
