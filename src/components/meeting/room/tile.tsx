"use client";

import { cn } from "cn";
import { Hand, MicOff, Pin, SignalLow, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { emojiFor } from "@/lib/meetings/events";

import { TrackView, type RoomParticipant } from "../media";
import { ParticipantMenu } from "./participant-menu";
import { EMOJI_FONT } from "./reactions";
import { useRoomBadges } from "./room-badges";
import { useRoomControls } from "./room-controls";

/**
 * One person (or their shared screen) on the stage: video or their avatar, the name
 * bottom-left with a muted icon, a green outline while speaking, a warning for a poor
 * connection, and a ⋯ menu on hover (always shown on touch screens).
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
  const badges = useRoomBadges();
  const controls = useRoomControls();
  const isScreen = kind === "screen";
  const pinned = !isScreen && controls.pinnedKey === participant.key;
  const spotlighted = !isScreen && controls.spotlight === participant.userId;
  const handUp = !isScreen && participant.userId in badges.hands;
  const reaction = isScreen
    ? undefined
    : badges.reactions.get(participant.userId);
  const showVideo = isScreen || participant.video;
  const name = isScreen
    ? t("screenOf", { name: participant.name })
    : participant.isLocal
      ? t("you", { name: participant.name })
      : participant.name;

  return (
    <div
      className={cn(
        "group/tile bg-card relative size-full overflow-hidden rounded-xl",
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

      {handUp || reaction ? (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {handUp ? (
            <span className="flex size-[30px] items-center justify-center rounded-full bg-[#f2b200] text-[#1b1500]">
              <Hand className="size-[18px]" aria-label={t("hand.raised")} />
            </span>
          ) : null}
          {reaction ? (
            <span
              aria-hidden="true"
              className={`${EMOJI_FONT} flex size-[34px] items-center justify-center rounded-full bg-white/95 text-[19px] leading-none shadow-[0_4px_12px_rgba(0,0,0,0.35)]`}
            >
              {emojiFor(reaction)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="absolute bottom-2.5 left-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[13px] leading-[18px] font-medium text-white">
        {spotlighted ? (
          <Star
            className="size-3.5 shrink-0 fill-current text-[#f2b200]"
            aria-label={t("spotlighted")}
          />
        ) : pinned ? (
          <Pin className="size-3.5 shrink-0" aria-label={t("pinned")} />
        ) : null}
        {!isScreen && !participant.audio ? (
          <MicOff
            className="size-3.5 shrink-0 text-[#ff7a7d]"
            aria-label={t("muted")}
          />
        ) : null}
        <span className="truncate">{name}</span>
      </div>

      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        {!isScreen && participant.connection === "poor" ? (
          <span
            className="flex size-7 items-center justify-center rounded-full bg-black/65 text-amber-300"
            title={t("poorConnection")}
          >
            <SignalLow className="size-4" aria-label={t("poorConnection")} />
          </span>
        ) : null}
        {isScreen ? null : (
          <ParticipantMenu
            participant={participant}
            className="bg-black/65 text-white opacity-0 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 hover:bg-black/80 aria-expanded:opacity-100 pointer-coarse:opacity-100"
          />
        )}
      </div>

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
