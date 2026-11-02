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
const MAX_FLOATING = 30;
/** Each sender gets at most this many through per 10 seconds. */
const PER_SENDER_PER_10S = 25;
/** The shortest gap between two of your own reactions: quick bursts work, as in Meet. */
const MIN_GAP_MS = 120;

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
    if (now - last < MIN_GAP_MS || recent.length >= PER_SENDER_PER_10S) {
      return false;
    }
    sent.current = [...recent, now];
    void send(code).catch(() => {});
    return true;
  };
}

/** A summary comes at most this often; one by one, at most every 1.5 seconds. */
const SUMMARY_EVERY_MS = 10_000;
const EACH_EVERY_MS = 1_500;

/**
 * What screen readers hear about other people's reactions (Settings → Reactions): a short
 * summary at most every 10 seconds ("3 reactions"), or each one ("Ana: Thumbs up", or a
 * summary when several come at once), or nothing.
 */
export function useReactionAnnouncement(
  reactions: LiveReaction[],
  selfId: string,
  mode: "off" | "summary" | "each",
  words: {
    summary: (count: number) => string;
    each: (reaction: LiveReaction) => string;
  },
): string {
  const [message, setMessage] = useState("");
  const counted = useRef(-1);
  const waiting = useRef<LiveReaction[]>([]);
  const lastAt = useRef(0);
  const timers = useRef<{ announce?: Timer; clear?: Timer }>({});
  const say = useEffectEvent((pending: LiveReaction[]) => {
    const [only] = pending;
    return pending.length === 1 && only && mode === "each"
      ? words.each(only)
      : words.summary(pending.length);
  });

  useEffect(() => {
    const fresh: LiveReaction[] = [];
    for (const reaction of reactions) {
      if (reaction.id > counted.current) {
        counted.current = reaction.id;
        if (reaction.userId !== selfId) fresh.push(reaction);
      }
    }
    if (mode === "off" || fresh.length === 0) return;
    waiting.current.push(...fresh);
    if (timers.current.announce) return; // an announcement is on its way
    const every = mode === "each" ? EACH_EVERY_MS : SUMMARY_EVERY_MS;
    const delay = Math.max(0, lastAt.current + every - Date.now());
    timers.current.announce = setTimeout(() => {
      timers.current.announce = undefined;
      lastAt.current = Date.now();
      setMessage(say(waiting.current));
      waiting.current = [];
      // Cleared again, so the same words next time still count as news.
      clearTimeout(timers.current.clear);
      timers.current.clear = setTimeout(() => setMessage(""), 3000);
    }, delay);
  }, [reactions, selfId, mode]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      clearTimeout(pending.announce);
      clearTimeout(pending.clear);
    };
  }, []);

  return mode === "off" ? "" : message;
}

type Timer = ReturnType<typeof setTimeout>;
