import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { aiNotesEnabled } from "@/lib/env";
import { reportError } from "@/lib/monitoring/report";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import type { NotesRequest, NotesSettingsRequest } from "./api";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import {
  findMeetingByCode,
  findOpenSession,
  openSessionsHostedBy,
  updateMeetingSettings,
} from "./queries";
import { canSetNotes } from "./rules";
import { changeSession, storeNotesAllowed } from "./session-state";

/**
 * AI notes on or off, for everyone: hosts and co-hosts only, where the meeting's host
 * allows them, and not in demo meetings. Everyone's browser sees it in the session's
 * shared state, so the chip and the banner reach every participant, and late joiners.
 * `auto`: a host's browser starting them as they join a meeting set to start them
 * automatically, which doesn't undo someone stopping them earlier in the session.
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
  const auto = input.request.on && input.request.auto === true;
  if (auto && !meeting.settings.autoNotes)
    throw new MeetingError("NOT_ALLOWED");
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
          auto,
        }
      : { notesOff: true },
  );
}

/**
 * The meeting's host, in the meeting: whether AI notes start automatically from now on,
 * and whether they're shared with its participants as they're made: the same settings as
 * on the schedule form and the personal room's page. Sharing reaches everyone in the
 * session at once, so the notes say up front where they'll go.
 */
export async function setNotesSettings(input: {
  code: string;
  principal: Principal | null;
  request: NotesSettingsRequest;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  if (principal.kind !== "user" || principal.userId !== meeting.hostId) {
    throw new MeetingError("NOT_ALLOWED");
  }
  const { autoNotes, shareNotes } = input.request;
  await updateMeetingSettings(meeting.id, meeting.hostId, {
    ...(autoNotes === undefined ? {} : { autoNotes }),
    ...(shareNotes === undefined ? {} : { shareNotes }),
  });
  if (shareNotes === undefined || shareNotes === meeting.settings.shareNotes) {
    return;
  }
  const [session, updated] = await Promise.all([
    findOpenSession(meeting.id),
    findMeetingByCode(input.code),
  ]);
  if (!session || !updated) return;
  try {
    await changeSession(updated.meeting, session, { meetingSettings: true });
  } catch (error) {
    // Saved; the session's next change publishes it.
    reportError("Couldn't publish a meeting's settings", error);
  }
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
      reportError("Couldn't publish a session's AI notes", error);
      await storeNotesAllowed(session.id, allowed);
    }
  }
}
