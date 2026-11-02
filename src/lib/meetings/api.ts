/**
 * The meeting API's request and response shapes, shared by the route handlers and the
 * meeting client. Safe to import in the browser.
 */
import { z } from "zod";

import type { JoinInfo, MeetingRole } from "@/lib/media/types";

import { SessionPolicy } from "./policy";

/** Error codes with their HTTP status. The client shows a message for each code. */
export const MEETING_ERRORS = {
  BAD_REQUEST: 400,
  SIGN_IN_REQUIRED: 401,
  BAD_PASSCODE: 403,
  LOCKED: 403,
  DENIED: 403,
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

export type Admitted = {
  state: "admitted";
  connection: JoinInfo;
  self: SelfInfo;
  meeting: AdmittedMeetingInfo;
  session: SessionInfo;
};

export type JoinResponse =
  | Admitted
  | { state: "waiting_for_host" }
  /** Asking to join through the waiting room: poll the request until a host decides. */
  | { state: "waiting"; requestId: string };

/** A waiting-room request, as its owner polls it. */
export type AdmissionResponse =
  | Admitted
  | { state: "waiting" }
  | { state: "denied" }
  /** Timed out, or the session it was for has ended: ask again. */
  | { state: "expired" };

/** Someone in the waiting room, as hosts see them. */
export type LobbyEntry = {
  id: string;
  name: string;
  image: string | null;
  guest: boolean;
  /** When they asked (ISO 8601). */
  askedAt: string;
};
export type LobbyResponse = { requests: LobbyEntry[] };

/** Hosts let people in, or turn them away. */
export const LobbyAction = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["admit", "deny"]),
    ids: z.array(z.uuid()).min(1).max(50),
  }),
  z.object({ action: z.literal("admitAll") }),
]);
export type LobbyAction = z.infer<typeof LobbyAction>;

export const TokenRequest = z.object({ room: z.uuid() });
export type TokenRequest = z.infer<typeof TokenRequest>;
export type TokenResponse = { token: string };

/** Someone's identity in the meeting (a media user ID). */
const MemberId = z.string().min(1).max(128);

/** Raise or lower your hand; hosts can lower anyone's, or everyone's. */
export const HandRequest = z.union([
  z.object({ raised: z.boolean(), target: MemberId.optional() }),
  z.object({ lowerAll: z.literal(true) }),
]);
export type HandRequest = z.infer<typeof HandRequest>;

/** AI notes: hosts and co-hosts turn them on or off, for everyone. */
export const NotesRequest = z.object({ on: z.boolean() });
export type NotesRequest = z.infer<typeof NotesRequest>;

/** What hosts and co-hosts can do to others, and to the meeting. */
export const ModerateRequest = z.discriminatedUnion("action", [
  /** Turn off someone's mic, camera or screen share. */
  z.object({
    action: z.literal("mute"),
    target: MemberId,
    kind: z.enum(["audio", "video", "screenshare"]),
  }),
  /** Mute everyone but hosts and co-hosts, and say whether they may unmute. */
  z.object({ action: z.literal("muteAll"), selfUnmute: z.boolean() }),
  z.object({ action: z.literal("askToUnmute"), target: MemberId }),
  /** Show someone large for everyone; null ends the spotlight. */
  z.object({ action: z.literal("spotlight"), target: MemberId.nullable() }),
  z.object({ action: z.literal("remove"), target: MemberId }),
  z.object({ action: z.literal("makeCohost"), target: MemberId }),
  z.object({ action: z.literal("removeCohost"), target: MemberId }),
  z.object({
    action: z.literal("setPolicy"),
    policy: SessionPolicy.partial().refine(
      (policy) => Object.keys(policy).length > 0,
    ),
  }),
]);
export type ModerateRequest = z.infer<typeof ModerateRequest>;
