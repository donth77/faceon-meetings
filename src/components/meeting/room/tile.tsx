"use client";

import { cn } from "cn";
import { MicOff, SignalLow } from "lucide-react";
import { useTranslations } from "next-intl";

import { TrackView, type RoomParticipant } from "../media";

/**
 * One person (or their shared screen) on the stage: video or their avatar, the name
 * bottom-left with a muted icon, a green outline while speaking, and a warning for a
 * poor connection.
 */
export function Tile({
  participant,
  kind = "video",
  className,
}: {
  participant: RoomParticipant;
  kind?: "video" | "screen";
  className?: string;
}) {
  const t = useTranslations("Meeting");
  const isScreen = kind === "screen";
  const showVideo = isScreen || participant.video;
  const name = isScreen
    ? t("screenOf", { name: participant.name })
    : participant.isLocal
      ? t("you", { name: participant.name })
      : participant.name;

  return (
    <div
      className={cn(
        "bg-card relative size-full overflow-hidden rounded-xl",
        className,
      )}
    >
      {showVideo ? (
        <TrackView
          participant={participant}
          kind={kind}
          className={cn(
            "absolute inset-0 size-full",
            isScreen ? "object-contain" : "object-cover",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {participant.image ? (
            // Avatars are small SVGs or provider photos; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={participant.image}
              alt=""
              className="aspect-square h-2/5 max-h-36 min-h-10 rounded-full shadow-[0_0_0_3px_rgb(255_255_255/0.08)]"
            />
          ) : null}
        </div>
      )}

      <div className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[13px] leading-[18px] font-medium text-white">
        {!isScreen && !participant.audio ? (
          <MicOff
            className="size-3.5 shrink-0 text-[#ff7a7d]"
            aria-label={t("muted")}
          />
        ) : null}
        <span className="truncate">{name}</span>
      </div>

      {!isScreen && participant.connection === "poor" ? (
        <span
          className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full bg-black/65 text-amber-300"
          title={t("poorConnection")}
        >
          <SignalLow className="size-4" aria-label={t("poorConnection")} />
        </span>
      ) : null}

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition-shadow duration-150",
          !isScreen &&
            participant.speaking &&
            "shadow-[inset_0_0_0_3px_#3ddc84]",
        )}
      />
    </div>
  );
}
