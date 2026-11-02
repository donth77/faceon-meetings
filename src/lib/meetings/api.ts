/**
 * The meeting API's request and response shapes, shared by the route handlers and the
 * meeting client. Safe to import in the browser.
 */
import { z } from "zod";

import type { JoinInfo, MeetingRole } from "@/lib/media/types";

/** Error codes with their HTTP status. The client shows a message for each code. */
export const MEETING_ERRORS = {
  BAD_REQUEST: 400,
  SIGN_IN_REQUIRED: 401,
  BAD_PASSCODE: 403,
  REMOVED: 403,
  NOT_ALLOWED: 403,
  NOT_FOUND: 404,
  FULL: 409,
  BUSY: 503,
  ENDED: 410,
  SESSION_ENDED: 410,
  RATE_LIMITED: 429,
  DEMO_LIMIT: 429,
  UNAVAILABLE: 503,
} as const;

export type MeetingErrorCode = keyof typeof MEETING_ERRORS;

export type MeetingErrorBody = { error: { code: MeetingErrorCode } };

/** A display name: trimmed, inner whitespace collapsed, 1–64 characters. */
export const DisplayName = z
  .string()
  .transform((name) => name.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(64));

export const JoinRequest = z.object({
  name: DisplayName,
  passcode: z.string().trim().max(32).optional(),
});
export type JoinRequest = z.input<typeof JoinRequest>;

/** Who you are in the meeting. */
export type SelfInfo = {
  id: string;
  name: string;
  image?: string;
  role: MeetingRole;
};

/** What members see in Meeting info. */
export type AdmittedMeetingInfo = {
  code: string;
  /** Null: show the default title for the host's name. */
  title: string | null;
  passcode: string | null;
  hostName: string;
  /** Join with the mic (or camera) off; hosts and co-hosts aren't affected. */
  muteOnEntry: boolean;
  videoOffOnEntry: boolean;
};

/** The session's limits; the time left is in seconds when admitted, so no clocks disagree. */
export type SessionInfo = {
  demo: boolean;
  maxParticipants: number;
  maxMinutes: number | null;
  secondsLeft: number | null;
  /** Ask "Are you still there?" after this long alone; null turns it off. */
  aloneTimeoutMinutes: number | null;
};

export type JoinResponse =
  | {
      state: "admitted";
      connection: JoinInfo;
      self: SelfInfo;
      meeting: AdmittedMeetingInfo;
      session: SessionInfo;
    }
  | { state: "waiting_for_host" };

export const TokenRequest = z.object({ room: z.uuid() });
export type TokenRequest = z.infer<typeof TokenRequest>;
export type TokenResponse = { token: string };
