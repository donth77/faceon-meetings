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
  ENDED: 410,
  SESSION_ENDED: 410,
  RATE_LIMITED: 429,
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
};

export type JoinResponse =
  | {
      state: "admitted";
      connection: JoinInfo;
      self: SelfInfo;
      meeting: AdmittedMeetingInfo;
    }
  | { state: "waiting_for_host" };

export const TokenRequest = z.object({ room: z.uuid() });
export type TokenRequest = z.infer<typeof TokenRequest>;
export type TokenResponse = { token: string };
