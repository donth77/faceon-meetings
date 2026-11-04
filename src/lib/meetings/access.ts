import "server-only";

import { MEETING_CODE_PATTERN } from "./codes";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import {
  findMeetingByCode,
  findMember,
  findOpenSession,
  isInvited,
  type MeetingMember,
  type MeetingSession,
} from "./queries";

/** The meeting with this ID, and its host; NOT_FOUND otherwise. */
export async function requireMeeting(code: string) {
  const found = MEETING_CODE_PATTERN.test(code)
    ? await findMeetingByCode(code)
    : null;
  if (!found) throw new MeetingError("NOT_FOUND");
  return found;
}

/**
 * Whether the meeting already knows this caller: its host, a co-host or invitee it names
 * (by a verified address), or someone admitted to its open session and not removed. They
 * skip the limits on failed joins (rules.ts, joinGate), so nobody else's wrong passcodes
 * can keep them out.
 */
export async function knownToMeeting(
  code: string,
  principal: Principal | null,
): Promise<boolean> {
  if (!principal || !MEETING_CODE_PATTERN.test(code)) return false;
  const found = await findMeetingByCode(code);
  if (!found) return false;
  const { meeting } = found;
  if (principal.kind === "user") {
    if (principal.userId === meeting.hostId) return true;
    if (
      principal.verifiedEmail !== null &&
      (await isInvited(meeting.id, principal.verifiedEmail))
    ) {
      return true;
    }
  }
  const session = await findOpenSession(meeting.id);
  if (!session) return false;
  const member = await findMember(session.id, principal.mediaUserId);
  return member !== null && !member.bannedAt;
}

export function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) throw new MeetingError("SIGN_IN_REQUIRED");
  return principal;
}

/**
 * The meeting's open session and the caller's admission to it: the check behind every
 * in-meeting action. With `room`, the session must be that one.
 */
export async function requireMember(
  meetingId: string,
  principal: Principal,
  room?: string,
): Promise<{ session: MeetingSession; member: MeetingMember }> {
  const session = await findOpenSession(meetingId);
  if (!session || (room !== undefined && session.id !== room)) {
    throw new MeetingError("SESSION_ENDED");
  }
  const member = await findMember(session.id, principal.mediaUserId);
  if (!member || member.bannedAt) throw new MeetingError("NOT_ALLOWED");
  return { session, member };
}
