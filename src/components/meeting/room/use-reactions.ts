"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

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
 * Everyone's reactions over the last few seconds. With reactions off, only hosts' get
 * through; a sender who floods is cut off after a few per 10 seconds.
 */
export function useReactions(
  subscribe: RoomMedia["subscribeReactions"],
  /** Whether to show a reaction from this sender. */
  accepts: (userId: string) => boolean,
) {
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const nextId = useRef(0);
  const perSender = useRef(new Map<string, number[]>());
  const accepted = useEffectEvent(accepts);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribe(({ userId, code }) => {
      if (!accepted(userId)) return;
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
  }, [subscribe]);

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

/** Screen readers hear about reactions at most this often. */
const ANNOUNCE_EVERY_MS = 10_000;

/**
 * A short summary of other people's reactions for screen readers ("3 reactions"), at most
 * every 10 seconds. Empty when announcements are off (Settings → Accessibility).
 */
export function useReactionAnnouncement(
  reactions: LiveReaction[],
  selfId: string,
  enabled: boolean,
  summarize: (count: number) => string,
): string {
  const [message, setMessage] = useState("");
  const counted = useRef(-1);
  const waiting = useRef(0);
  const lastAt = useRef(0);
  const timers = useRef<{ announce?: Timer; clear?: Timer }>({});
  const summary = useEffectEvent(summarize);

  useEffect(() => {
    let fresh = 0;
    for (const reaction of reactions) {
      if (reaction.id > counted.current) {
        counted.current = reaction.id;
        if (reaction.userId !== selfId) fresh++;
      }
    }
    if (!enabled || fresh === 0) return;
    waiting.current += fresh;
    if (timers.current.announce) return; // a summary is on its way
    const delay = Math.max(0, lastAt.current + ANNOUNCE_EVERY_MS - Date.now());
    timers.current.announce = setTimeout(() => {
      timers.current.announce = undefined;
      lastAt.current = Date.now();
      setMessage(summary(waiting.current));
      waiting.current = 0;
      // Cleared again, so the same words next time still count as news.
      clearTimeout(timers.current.clear);
      timers.current.clear = setTimeout(() => setMessage(""), 3000);
    }, delay);
  }, [reactions, selfId, enabled]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      clearTimeout(pending.announce);
      clearTimeout(pending.clear);
    };
  }, []);

  return enabled ? message : "";
}

type Timer = ReturnType<typeof setTimeout>;
