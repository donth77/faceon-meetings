import "server-only";

import { MEETING_CODE_PATTERN } from "./codes";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import {
  findMeetingByCode,
  findMember,
  findOpenSession,
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
