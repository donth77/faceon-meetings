/**
 * What hosts and co-hosts can change while a meeting runs. Each session starts from the
 * meeting's settings; changes last until the session ends. Safe to import in the browser.
 */
import { z } from "zod";

import type { MeetingSettings } from "./settings";

export const SessionPolicy = z.object({
  /** Nobody new can join, even with the link and passcode. */
  locked: z.boolean(),
  /** Participants can send chat messages. */
  chat: z.boolean(),
  /** Participants can send reactions. */
  reactions: z.boolean(),
  /** Who can share their screen. */
  screenShare: z.enum(["host", "all"]),
  /** Participants can turn their own mic on. */
  selfUnmute: z.boolean(),
});
export type SessionPolicy = z.infer<typeof SessionPolicy>;

export const policyFromSettings = (
  settings: MeetingSettings,
): SessionPolicy => ({
  locked: false,
  chat: settings.chat,
  reactions: settings.reactions,
  screenShare: settings.screenShare,
  selfUnmute: settings.allowSelfUnmute,
});
