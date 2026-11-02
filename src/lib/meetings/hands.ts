import "server-only";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import type { HandRequest } from "./api";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import { isHostRole } from "./rules";
import { changeHands, type HandChange } from "./session-state";

/**
 * Raise hand: anyone admitted raises or lowers their own; hosts and co-hosts can lower
 * anyone's, or everyone's. Nobody raises someone else's.
 */
export async function updateHand(input: {
  code: string;
  principal: Principal | null;
  request: HandRequest;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const { session, member } = await requireMember(meeting.id, principal);
  const isHost = isHostRole(member.role);
  const { request } = input;

  let change: HandChange;
  if ("lowerAll" in request) {
    if (!isHost) throw new MeetingError("NOT_ALLOWED");
    change = { lowerAll: true };
  } else {
    const subject = request.target ?? principal.mediaUserId;
    const forSomeoneElse = subject !== principal.mediaUserId;
    if (forSomeoneElse && (request.raised || !isHost)) {
      throw new MeetingError("NOT_ALLOWED");
    }
    change = request.raised ? { raise: subject } : { lower: subject };
  }
  await changeHands(meeting, session, change);
}
