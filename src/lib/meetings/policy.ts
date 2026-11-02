/**
 * What hosts and co-hosts can change while a meeting runs. Each session starts from the
 * meeting's settings; changes last until the session ends. Safe to import in the browser.
 */
import { z } from "zod";

import type { PublishPermissions } from "@/lib/media/types";

import type { MeetingSettings } from "./settings";

export const SessionPolicy = z.object({
  /** Nobody new can join, even with the link and passcode. */
  locked: z.boolean(),
  /** Newcomers ask to join, and hosts let each one in. */
  waitingRoom: z.boolean(),
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
  waitingRoom: settings.waitingRoom,
  chat: settings.chat,
  reactions: settings.reactions,
  screenShare: settings.screenShare,
  selfUnmute: settings.allowSelfUnmute,
});

/**
 * What a participant (not a host or co-host) may publish under a policy: screen sharing
 * may be for hosts only, and the mic may need a host's OK. Null when nothing is withheld.
 */
export function withheldFrom(policy: SessionPolicy): PublishPermissions | null {
  const withheld: PublishPermissions = {
    ...(policy.selfUnmute ? {} : { audio: false }),
    ...(policy.screenShare === "host" ? { screen: false } : {}),
  };
  return Object.keys(withheld).length > 0 ? withheld : null;
}
