/**
 * Messages participants send each other through the media provider: chat and host
 * prompts as events, plus reactions. Every one is validated on receipt, so a modified
 * client can't inject anything else. Nothing here is stored.
 */
import { z } from "zod";

import { SessionPolicy } from "./policy";

/** The reaction set, in menu order. Receivers ignore any other code. */
export const REACTIONS = [
  { code: ":like:", emoji: "👍", name: "thumbsUp" },
  { code: ":heart:", emoji: "❤️", name: "heart" },
  { code: ":laughing:", emoji: "😂", name: "laugh" },
  { code: ":open_mouth:", emoji: "😮", name: "wow" },
  { code: ":clap:", emoji: "👏", name: "clap" },
  { code: ":tada:", emoji: "🎉", name: "celebrate" },
] as const;

export type ReactionCode = (typeof REACTIONS)[number]["code"];

const CODES: ReadonlySet<string> = new Set(REACTIONS.map((r) => r.code));

export const isReactionCode = (value: unknown): value is ReactionCode =>
  typeof value === "string" && CODES.has(value);

export const emojiFor = (code: ReactionCode) =>
  REACTIONS.find((reaction) => reaction.code === code)?.emoji ?? "";

/** Chat messages are short; custom events are capped at 5 KB anyway. */
export const MAX_CHAT_LENGTH = 1000;

export const RoomEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat.message"),
    id: z.string().min(1).max(64),
    text: z.string().trim().min(1).max(MAX_CHAT_LENGTH),
  }),
  /** A host asks one person to unmute; they decide. */
  z.object({
    type: z.literal("host.request_unmute"),
    target: z.string().min(1).max(128),
  }),
]);
export type RoomEvent = z.infer<typeof RoomEvent>;

/** Who sent an event, as the provider reports it; null when our server sent it. */
export type EventSender = { userId: string; name: string; image?: string };

/**
 * The session's shared state, which the server publishes (complete, with an increasing
 * `rev`) for every participant: who hosts, raised hands, the spotlight and the hosts'
 * policies.
 */
export const SharedSessionState = SessionPolicy.extend({
  v: z.literal(1),
  rev: z.number().int(),
  // Defaults keep sessions that started before these existed readable. Stream stores an
  // empty list as null, so lists and maps accept null too.
  selfUnmute: z.boolean().default(true),
  /** The owner's media user ID. */
  host: z.string().default(""),
  cohosts: z
    .array(z.string())
    .nullish()
    .transform((ids) => ids ?? []),
  /** Shown large for everyone: a media user ID. */
  spotlight: z
    .string()
    .nullish()
    .transform((id) => id ?? null),
  /** Media user ID → when the hand went up (ISO 8601). */
  hands: z
    .record(z.string(), z.string())
    .nullish()
    .transform((hands) => hands ?? {}),
});
export type SharedSessionState = z.infer<typeof SharedSessionState>;
