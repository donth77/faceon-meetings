"use client";

import { cn } from "cn";
import { Hand, Mic, MicOff, Pin, SignalLow, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useState, type CSSProperties } from "react";

import { emojiFor } from "@/lib/meetings/events";

import {
  TrackView,
  useAudioLevel,
  useSpeaking,
  type RoomParticipant,
} from "../media";
import { ParticipantMenu } from "./participant-menu";
import { EMOJI_FONT } from "./reactions";
import { useRoomBadges } from "./room-badges";
import { useRoomControls } from "./room-controls";
import { croppable, WIDESCREEN } from "./stage-layout";

/**
 * Where tiles say what shape their picture is (a participant's key, camera or screen,
 * width over height), so the stage can shape a large tile to it. The stage provides it.
 */
export const TileShapes = createContext<
  ((key: string, kind: "video" | "screen", ratio: number) => void) | null
>(null);

/**
 * How loud someone sounds while they speak, 0 to 1, shaped so normal speech fills most
 * of the range. Read per component, so only what shows it redraws as it changes.
 */
function useLoudness(participant: RoomParticipant): number {
  const speaking = useSpeaking(participant.key);
  const level = useAudioLevel(participant.key, speaking);
  return speaking ? Math.min(1, Math.sqrt(level) * 1.6) : 0;
}

/**
 * Three green bars that move with someone's voice while they speak, as in Meet (the
 * logo's green, as for everything live); a mic while they're quiet, and a crossed-out
 * one while they're muted.
 */
export function VoiceLevel({ participant }: { participant: RoomParticipant }) {
  const t = useTranslations("Meeting");
  const level = useLoudness(participant);
  if (!participant.audio) {
    return (
      <MicOff
        className="text-destructive-text size-3.5 shrink-0"
        aria-label={t("muted")}
      />
    );
  }
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
            "bg-live w-[3px] rounded-full transition-[height] duration-150 ease-out motion-reduce:transition-none",
          )}
        />
      ))}
    </span>
  );
}

/** Grows with their voice around their picture, like the ripple around a speaker in Meet. */
function SpeakingRing({ participant }: { participant: RoomParticipant }) {
  const speaking = useSpeaking(participant.key);
  const level = useLoudness(participant);
  return (
    <span
      aria-hidden="true"
      style={{ transform: `scale(${1 + 0.32 * level})` }}
      className={cn(
        "bg-live/30 ring-live/70 absolute inset-0 rounded-full ring-2 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none",
        speaking ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/** The green outline around a tile while its person speaks, in the logo's green. */
function SpeakingOutline({ participant }: { participant: RoomParticipant }) {
  const speaking = useSpeaking(participant.key);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-xl transition-shadow duration-200 motion-reduce:transition-none",
        speaking &&
          "shadow-[inset_0_0_0_3px_var(--live),inset_0_0_18px_color-mix(in_srgb,var(--live)_30%,transparent)]",
      )}
    />
  );
}

/**
 * One person (or their shared screen) on the stage: video or their avatar, the name
 * bottom-left with their voice level (or a muted icon), a green outline while
 * speaking, a ring that pulses around the avatar with their voice, a warning for a
 * poor connection, and a ⋯ menu on hover (always shown on touch screens).
 *
 * A camera fills the tile, cropped by no more than a fifth of its width or height; a
 * tile of a very different shape shows the rest of the picture with space around it.
 * A shared screen is never cropped.
 */
export function Tile({
  participant,
  kind = "video",
  cover = false,
  className,
}: {
  participant: RoomParticipant;
  kind?: "video" | "screen";
  /** Fill the tile with the camera however much that crops: a one-on-one on a phone, as in Meet. */
  cover?: boolean;
  className?: string;
}) {
  const t = useTranslations("Meeting");
  const badges = useRoomBadges();
  const controls = useRoomControls();
  const reportShape = useContext(TileShapes);
  const [aspect, setAspect] = useState<number | null>(null);
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
  // How far the picture may be cropped, for the video's box below.
  const crop = croppable(aspect ?? WIDESCREEN);
  function learnShape(ratio: number) {
    // Two decimals: a different simulcast layer of the same camera isn't a new shape.
    const rounded = Math.round(ratio * 100) / 100;
    setAspect(rounded);
    reportShape?.(participant.key, kind, rounded);
  }

  return (
    <div
      // Who's in the tile and what it shows, for the browser tests (tests/e2e).
      data-tile={kind}
      data-name={participant.name}
      data-local={participant.isLocal || undefined}
      style={
        { "--crop-min": crop.min, "--crop-max": crop.max } as CSSProperties
      }
      className={cn(
        "group/tile bg-card [container-type:size] relative size-full overflow-hidden rounded-xl",
        className,
      )}
    >
      {showVideo ? (
        <TrackView
          participant={participant}
          kind={kind}
          onAspectRatio={learnShape}
          className={cn(
            "absolute inset-0",
            isScreen
              ? "size-full object-contain"
              : cover
                ? "size-full object-cover"
                : // The tile's box, unless that would crop past the limit: then the
                  // picture's own shape, as near the tile's as the limit allows.
                  "m-auto h-[min(100cqh,calc(100cqw/var(--crop-min)))] w-[min(100cqw,calc(100cqh*var(--crop-max)))] object-cover",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {participant.image ? (
            <span className="relative aspect-square h-2/5 max-h-36 min-h-10">
              <SpeakingRing participant={participant} />
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
        <div className="absolute top-[calc(0.625rem+var(--tile-inset-top,0px))] left-2.5 flex items-center gap-1.5 transition-[top] duration-200 ease-out motion-reduce:transition-none">
          {handUp ? (
            <span className="animate-in zoom-in-50 fade-in bg-hand text-hand-foreground flex size-[30px] items-center justify-center rounded-full duration-200 motion-reduce:animate-none">
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

      <div className="absolute bottom-[calc(0.625rem+var(--tile-inset-bottom,0px))] left-2.5 flex max-w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-[13px] leading-[18px] font-medium text-white transition-[bottom] duration-200 ease-out motion-reduce:transition-none">
        {spotlighted ? (
          <Star
            className="text-hand size-3.5 shrink-0 fill-current"
            aria-label={t("spotlighted")}
          />
        ) : pinned ? (
          <Pin className="size-3.5 shrink-0" aria-label={t("pinned")} />
        ) : null}
        {isScreen ? null : <VoiceLevel participant={participant} />}
        <span className="truncate">{name}</span>
      </div>

      <div className="absolute top-[calc(0.625rem+var(--tile-inset-top,0px))] right-2.5 flex items-center gap-1.5 transition-[top] duration-200 ease-out motion-reduce:transition-none">
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

      {isScreen ? null : <SpeakingOutline participant={participant} />}
    </div>
  );
}
