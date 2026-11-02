"use client";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";

import type { DeviceProblem } from "@/lib/device/problems";

import { playSound } from "../chime";
import type { RoomMedia, RoomParticipant } from "../media";

/** Past this many people, joins and leaves make no sound, as in Meet: it would never stop. */
const SOUNDS_UP_TO = 8;

/**
 * A sound as you join, then as others join and leave. The people already here when you
 * arrive (who show up over the first moments) don't each get a sound.
 */
export function usePresenceSounds(participants: RoomParticipant[]) {
  const known = useRef<Set<string> | null>(null);
  const settledAt = useRef(0);
  useEffect(() => {
    playSound("youJoined");
    settledAt.current = performance.now() + 2500;
  }, []);
  useEffect(() => {
    const others = new Set(
      participants.filter((p) => !p.isLocal).map((p) => p.key),
    );
    const before = known.current;
    known.current = others;
    if (!before || performance.now() < settledAt.current) return;
    if (participants.length > SOUNDS_UP_TO) return;
    if ([...others].some((key) => !before.has(key))) playSound("someoneJoined");
    else if ([...before].some((key) => !others.has(key)))
      playSound("someoneLeft");
  }, [participants]);
}

/**
 * "You're muted" when you seem to be talking with the mic off, at most once a minute. Not
 * when you can't unmute, and not after a host muted you until you've unmuted yourself
 * again: asking then would undo what they just did ("The host muted you" says why).
 */
export function useMutedNudge(media: RoomMedia, onUnmute: () => void) {
  const t = useTranslations("Meeting");
  const lastAt = useRef(0);
  const hostMuted = useRef(false);
  const unmute = useEffectEvent(onUnmute);
  const { subscribeHostMutes } = media;
  const { enabled, allowed, speakingWhileMuted } = media.mic;
  useEffect(
    () =>
      subscribeHostMutes((kind) => {
        if (kind === "audio") hostMuted.current = true;
      }),
    [subscribeHostMutes],
  );
  useEffect(() => {
    if (enabled) hostMuted.current = false;
  }, [enabled]);
  useEffect(() => {
    if (
      !speakingWhileMuted ||
      !allowed ||
      hostMuted.current ||
      Date.now() - lastAt.current < 60_000
    ) {
      return;
    }
    lastAt.current = Date.now();
    toast(t("mutedNudge"), {
      id: "muted-nudge",
      action: { label: t("unmute"), onClick: () => unmute() },
    });
  }, [speakingWhileMuted, allowed, t]);
}

/** A toast when the mic or camera fails to start, saying what to do, with Try again. */
export function useDeviceProblemToast(
  device: "microphone" | "camera",
  problem: DeviceProblem | null,
  retry: () => Promise<void>,
) {
  const t = useTranslations("DeviceProblems");
  const tp = useTranslations("PreJoin");
  const onRetry = useEffectEvent(() => void retry());
  useEffect(() => {
    if (!problem) return;
    toast.error(t(`${device}.${problem}`), {
      action: { label: tp("tryAgain"), onClick: () => onRetry() },
    });
  }, [device, problem, t, tp]);
}
