"use client";

import { cn } from "cn";
import { Hand, Mic, MicOff, Pin, SignalLow, Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { emojiFor } from "@/lib/meetings/events";

import { TrackView, type RoomParticipant } from "../media";
import { ParticipantMenu } from "./participant-menu";
import { EMOJI_FONT } from "./reactions";
import { useRoomBadges } from "./room-badges";
import { useRoomControls } from "./room-controls";

/** How loud someone sounds, 0 to 1, shaped so normal speech fills most of the range. */
const loudness = (participant: RoomParticipant) =>
  participant.speaking
    ? Math.min(1, Math.sqrt(participant.audioLevel) * 1.6)
    : 0;

/**
 * Three green bars that move with someone's voice while they speak, as in Meet; a mic
 * while they're quiet, and a crossed-out one while they're muted.
 */
function VoiceLevel({ participant }: { participant: RoomParticipant }) {
  const t = useTranslations("Meeting");
  if (!participant.audio) {
    return (
      <MicOff
        className="size-3.5 shrink-0 text-[#ff7a7d]"
        aria-label={t("muted")}
      />
    );
  }
  const level = loudness(participant);
  if (level === 0) {
    return (
      <Mic className="size-3.5 shrink-0 text-white/80" aria-hidden="true" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-3.5 shrink-0 items-center justify-center gap-[2px]"
    >
      {[0.55, 1, 0.55].map((weight, index) => (
        <span
          key={index}
          style={{ height: 3 + Math.round(11 * level * weight) }}
          className={cn(
            "w-[3px] rounded-full bg-[#3ddc84] transition-[height] duration-150 ease-out motion-reduce:transition-none",
          )}
        />
      ))}
    </span>
  );
}

/**
 * One person (or their shared screen) on the stage: video or their avatar, the name
 * bottom-left with their voice level (or a muted icon), a green outline while
 * speaking, a ring that pulses around the avatar with their voice, a warning for a
 * poor connection, and a ⋯ menu on hover (always shown on touch screens).
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
            <span className="relative aspect-square h-2/5 max-h-36 min-h-10">
              {/* Grows with their voice, like the ripple around a speaker in Meet. */}
              <span
                aria-hidden="true"
                style={{
                  transform: `scale(${1 + 0.32 * loudness(participant)})`,
                }}
                className={cn(
                  "absolute inset-0 rounded-full bg-[#3ddc84]/30 ring-2 ring-[#3ddc84]/70 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none",
                  participant.speaking ? "opacity-100" : "opacity-0",
                )}
              />
              {/* Avatars are small SVGs or provider photos; next/image adds nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={participant.image}
                alt=""
                className="relative size-full rounded-full shadow-[0_0_0_3px_rgb(255_255_255/0.08)]"
              />
            </span>
          ) : null}
        </div>
      )}

      {handUp || reaction ? (
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {handUp ? (
            <span className="animate-in zoom-in-50 fade-in flex size-[30px] items-center justify-center rounded-full bg-[#f2b200] text-[#1b1500] duration-200 motion-reduce:animate-none">
              <Hand className="size-[18px]" aria-label={t("hand.raised")} />
            </span>
          ) : null}
          {reaction ? (
            <span
              aria-hidden="true"
              className={`${EMOJI_FONT} animate-in zoom-in-50 fade-in flex size-[34px] items-center justify-center rounded-full bg-white/95 text-[19px] leading-none shadow-[0_4px_12px_rgba(0,0,0,0.35)] duration-200 motion-reduce:animate-none`}
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
        {isScreen ? null : <VoiceLevel participant={participant} />}
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
          "pointer-events-none absolute inset-0 rounded-xl transition-shadow duration-200 motion-reduce:transition-none",
          !isScreen &&
            participant.speaking &&
            "shadow-[inset_0_0_0_3px_#3ddc84,inset_0_0_18px_rgb(61_220_132/0.3)]",
        )}
      />
    </div>
  );
}
