import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { aiNotesEnabled } from "@/lib/env";
import { loggable } from "@/lib/log";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import type { NotesRequest } from "./api";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import { openSessionsHostedBy } from "./queries";
import { canSetNotes } from "./rules";
import { changeSession, storeNotesAllowed } from "./session-state";

/**
 * AI notes on or off, for everyone: hosts and co-hosts only, where the meeting's host
 * allows them, and not in demo meetings. Everyone's browser sees it in the session's
 * shared state, so the chip and the banner reach every participant, and late joiners.
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
    allowed: session.notesAllowed,
  });
  if (!allowed) throw new MeetingError("NOT_ALLOWED");
  // Already as asked: keep who turned them on, and when. (The change itself checks
  // again under the session's lock, in case another host just did the same.)
  if (input.request.on === (session.notes != null)) return;
  await changeSession(
    meeting,
    session,
    input.request.on
      ? {
          notesOn: {
            by: principal.mediaUserId,
            name: member.displayName,
            startedAt: new Date().toISOString(),
          },
        }
      : { notesOff: true },
  );
}

/** Whether the meetings someone hosts offer AI notes (Settings → AI notes). */
export async function notesAllowedFor(userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ aiNotes: user.aiNotes })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.aiNotes ?? false;
}

/**
 * Settings → AI notes: whether the meetings someone hosts offer AI notes. Meetings
 * happening now follow at once: hosts there can start them, or, turned off, notes in
 * progress stop for everyone.
 */
export async function allowNotesInMeetings(
  userId: string,
  allowed: boolean,
): Promise<void> {
  await db().update(user).set({ aiNotes: allowed }).where(eq(user.id, userId));
  for (const { meeting, session } of await openSessionsHostedBy(userId)) {
    if (session.notesAllowed === allowed) continue;
    try {
      await changeSession(meeting, session, { notesAllowed: allowed });
    } catch (error) {
      console.error("Couldn't publish a session's AI notes", loggable(error));
      await storeNotesAllowed(session.id, allowed);
    }
  }
}
