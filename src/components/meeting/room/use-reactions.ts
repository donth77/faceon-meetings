"use client";

import { useEffect, useRef, useState } from "react";

import type { ReactionCode } from "@/lib/meetings/events";

import type { RoomMedia } from "../media";

export type LiveReaction = {
  id: number;
  userId: string;
  code: ReactionCode;
  at: number;
};

/** A reaction floats for this long, and stays on the sender's tile a little longer. */
export const FLOAT_MS = 3500;
export const BADGE_MS = 5000;
/** At most this many float at once; older ones drop first. */
const MAX_FLOATING = 12;
/** Each sender gets at most this many through per 10 seconds. */
const PER_SENDER_PER_10S = 10;

/**
 * Everyone's reactions over the last few seconds. Turned off when the host disallows
 * reactions; a sender who floods is cut off after a few per 10 seconds.
 */
export function useReactions(
  subscribe: RoomMedia["subscribeReactions"],
  enabled: boolean,
) {
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const nextId = useRef(0);
  const perSender = useRef(new Map<string, number[]>());

  useEffect(() => {
    if (!enabled) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribe(({ userId, code }) => {
      const now = Date.now();
      const recent = (perSender.current.get(userId) ?? []).filter(
        (at) => now - at < 10_000,
      );
      if (recent.length >= PER_SENDER_PER_10S) return;
      perSender.current.set(userId, [...recent, now]);

      const reaction = { id: nextId.current++, userId, code, at: now };
      setReactions((list) => [...list, reaction].slice(-MAX_FLOATING * 2));
      const timer = setTimeout(() => {
        timers.delete(timer);
        setReactions((list) => list.filter((r) => r.id !== reaction.id));
      }, BADGE_MS);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
      setReactions([]);
    };
  }, [subscribe, enabled]);

  return reactions;
}

/**
 * Sends a reaction, at most one per half second and 10 per 10 seconds (receivers drop
 * the rest anyway). Returns false when throttled.
 */
export function useReactionSender(send: RoomMedia["sendReaction"]) {
  const sent = useRef<number[]>([]);
  return (code: ReactionCode): boolean => {
    const now = Date.now();
    const recent = sent.current.filter((at) => now - at < 10_000);
    const last = recent.at(-1) ?? 0;
    if (now - last < 500 || recent.length >= PER_SENDER_PER_10S) return false;
    sent.current = [...recent, now];
    void send(code).catch(() => {});
    return true;
  };
}
