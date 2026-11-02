import "server-only";

import { aiNotesEnabled } from "@/lib/env";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import type { NotesRequest } from "./api";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import { canSetNotes } from "./rules";
import { changeSession } from "./session-state";

/**
 * AI notes on or off, for everyone: hosts and co-hosts only, and not in demo meetings.
 * Everyone's browser sees it in the session's shared state, so the chip and the banner
 * reach every participant, and late joiners.
 */
export async function setNotes(input: {
  code: string;
  principal: Principal | null;
  request: NotesRequest;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const { session, member } = await requireMember(meeting.id, principal);
  if (input.request.on && !aiNotesEnabled) {
    throw new MeetingError("NOT_ALLOWED");
  }
  const allowed = canSetNotes({
    actor: member.role,
    on: input.request.on,
    demo: session.limits.demo === true,
  });
  if (!allowed) throw new MeetingError("NOT_ALLOWED");
  // Already as asked: keep who turned them on, and when.
  if (input.request.on === (session.notes != null)) return;
  await changeSession(meeting, session, {
    notes: input.request.on
      ? {
          by: principal.mediaUserId,
          name: member.displayName,
          startedAt: new Date().toISOString(),
        }
      : null,
  });
}
