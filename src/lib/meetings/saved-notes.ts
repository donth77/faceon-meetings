import "server-only";

import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNull,
  lt,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  meeting,
  meetingMember,
  meetingNotes,
  meetingSession,
  participantSession,
  user,
} from "@/lib/db/schema";
import { aiNotesEnabled } from "@/lib/env";
import {
  MAX_SAVED_NOTES_BYTES,
  savedNotesBytes,
  type EngineId,
  type MeetingNotes,
} from "@/lib/notes/notes";
import type { ProviderId } from "@/lib/notes/providers";
import { isUuid } from "@/lib/uuid";

import { requireMeeting, requirePrincipal } from "./access";
import type { SaveNotesRequest } from "./api";
import { MeetingError } from "./errors";
import type { Principal } from "./principal";
import { attendedBy, findMember } from "./queries";
import { canManageNotes, canReadNotes, canSaveNotes } from "./rules";

/** A session of the meeting with this code, ended or not. */
async function sessionOf(code: string, sessionId: string) {
  const { meeting: found } = await requireMeeting(code);
  const [session] = isUuid(sessionId)
    ? await db()
        .select()
        .from(meetingSession)
        .where(
          and(
            eq(meetingSession.id, sessionId),
            eq(meetingSession.meetingId, found.id),
          ),
        )
        .limit(1)
    : [];
  if (!session) throw new MeetingError("NOT_FOUND");
  return { meeting: found, session };
}

/**
 * Saves AI notes to a session: hosts and co-hosts with an account who were in it, also
 * after it ended. Notes already saved are replaced only by whoever saved them, or by
 * the host, as with sharing and deleting them.
 */
export async function saveNotes(input: {
  code: string;
  sessionId: string;
  principal: Principal | null;
  request: SaveNotesRequest;
}): Promise<void> {
  if (!aiNotesEnabled) throw new MeetingError("NOT_ALLOWED");
  const principal = requirePrincipal(input.principal);
  const { meeting: found, session } = await sessionOf(
    input.code,
    input.sessionId,
  );
  const member = await findMember(session.id, principal.mediaUserId);
  const userId = principal.kind === "user" ? principal.userId : null;
  if (
    !member ||
    member.bannedAt ||
    !userId ||
    !canSaveNotes({ role: member.role, userId })
  ) {
    throw new MeetingError("NOT_ALLOWED");
  }
  const { notes, transcript } = input.request;
  if (savedNotesBytes(notes, transcript) > MAX_SAVED_NOTES_BYTES) {
    throw new MeetingError("BAD_REQUEST");
  }
  const row = {
    savedBy: userId,
    notes,
    transcript,
    engine: input.request.engine,
    provider: input.request.provider,
    madeAt: new Date(input.request.madeAt),
    shared: input.request.shared,
    savedAt: new Date(),
  };
  // One statement, so two people saving at once can't replace each other's notes.
  const saved = await db()
    .insert(meetingNotes)
    .values({ sessionId: session.id, ...row })
    .onConflictDoUpdate({
      target: meetingNotes.sessionId,
      set: row,
      setWhere:
        userId === found.hostId ? undefined : eq(meetingNotes.savedBy, userId),
    })
    .returning({ sessionId: meetingNotes.sessionId });
  if (saved.length === 0) throw new MeetingError("NOT_ALLOWED");
}

/** The saved notes, and whether the signed-in viewer may change them. */
async function managedNotes(input: {
  code: string;
  sessionId: string;
  principal: Principal | null;
}) {
  const principal = requirePrincipal(input.principal);
  if (principal.kind !== "user") throw new MeetingError("NOT_ALLOWED");
  const { meeting: found, session } = await sessionOf(
    input.code,
    input.sessionId,
  );
  const [saved] = await db()
    .select({ savedBy: meetingNotes.savedBy })
    .from(meetingNotes)
    .where(eq(meetingNotes.sessionId, session.id))
    .limit(1);
  if (!saved) throw new MeetingError("NOT_FOUND");
  const allowed = canManageNotes({
    viewer: principal.userId,
    savedBy: saved.savedBy,
    hostId: found.hostId,
  });
  if (!allowed) throw new MeetingError("NOT_ALLOWED");
  return session;
}

/** Shares saved notes with the session's attendees, or stops: whoever saved them, or the host. */
export async function shareNotes(input: {
  code: string;
  sessionId: string;
  principal: Principal | null;
  shared: boolean;
}): Promise<void> {
  const session = await managedNotes(input);
  await db()
    .update(meetingNotes)
    .set({ shared: input.shared })
    .where(eq(meetingNotes.sessionId, session.id));
}

/** Deletes saved notes: whoever saved them, or the host. */
export async function deleteNotes(input: {
  code: string;
  sessionId: string;
  principal: Principal | null;
}): Promise<void> {
  const session = await managedNotes(input);
  await db().delete(meetingNotes).where(eq(meetingNotes.sessionId, session.id));
}

/** Saved notes, as their page shows them (times in ISO 8601). */
export type SavedNotes = {
  sessionId: string;
  code: string;
  title: string | null;
  hostName: string;
  start: string;
  end: string;
  /** How many people came. */
  people: number;
  notes: MeetingNotes;
  transcript: string | null;
  engine: EngineId;
  provider: ProviderId | null;
  madeAt: string;
  shared: boolean;
  /** The viewer saved them, or hosts the meeting: they can share or delete them. */
  canManage: boolean;
};

/** A session's saved notes, if the viewer may see them. */
export async function savedNotesFor(
  sessionId: string,
  viewerId: string,
): Promise<SavedNotes | null> {
  if (!isUuid(sessionId)) return null;
  const [row] = await db()
    .select({
      notes: meetingNotes,
      session: meetingSession,
      code: meeting.code,
      title: meeting.title,
      hostId: meeting.hostId,
      hostName: user.name,
      attended: sql<boolean>`${attendedBy(viewerId)}`,
    })
    .from(meetingNotes)
    .innerJoin(meetingSession, eq(meetingSession.id, meetingNotes.sessionId))
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(eq(meetingNotes.sessionId, sessionId))
    .limit(1);
  if (!row) return null;
  const access = {
    viewer: viewerId,
    savedBy: row.notes.savedBy,
    hostId: row.hostId,
  };
  if (
    !canReadNotes({
      ...access,
      shared: row.notes.shared,
      attended: row.attended,
    })
  ) {
    return null;
  }
  // From attendance, which lasts as long as the notes; admissions go after a week.
  const [[attended], [admitted]] = await Promise.all([
    db()
      .select({ count: countDistinct(participantSession.mediaUserId) })
      .from(participantSession)
      .where(eq(participantSession.sessionId, sessionId)),
    db()
      .select({ count: count() })
      .from(meetingMember)
      .where(
        and(
          eq(meetingMember.sessionId, sessionId),
          isNull(meetingMember.bannedAt),
        ),
      ),
  ]);
  return {
    sessionId,
    code: row.code,
    title: row.title,
    hostName: row.hostName,
    start: row.session.startedAt.toISOString(),
    end: (row.session.endedAt ?? row.notes.madeAt).toISOString(),
    people: attended?.count || admitted?.count || 0,
    notes: row.notes.notes,
    transcript: row.notes.transcript,
    engine: row.notes.engine,
    provider: row.notes.provider,
    madeAt: row.notes.madeAt.toISOString(),
    shared: row.notes.shared,
    canManage: canManageNotes(access),
  };
}

/**
 * Which of these sessions have saved notes the viewer may see, whether they're shared,
 * and whether their transcript was saved with them. Previous lists only sessions the
 * viewer hosted or was in.
 */
export async function notesInPrevious(
  sessions: Array<{ id: string; hostId: string }>,
  viewerId: string,
): Promise<Map<string, { shared: boolean; transcript: boolean }>> {
  if (sessions.length === 0) return new Map();
  const rows = await db()
    .select({
      sessionId: meetingNotes.sessionId,
      savedBy: meetingNotes.savedBy,
      shared: meetingNotes.shared,
      transcript: sql<boolean>`${meetingNotes.transcript} is not null`,
    })
    .from(meetingNotes)
    .where(
      inArray(
        meetingNotes.sessionId,
        sessions.map((s) => s.id),
      ),
    );
  const hostOf = new Map(sessions.map((s) => [s.id, s.hostId]));
  return new Map(
    rows
      .filter((row) =>
        canReadNotes({
          viewer: viewerId,
          savedBy: row.savedBy,
          hostId: hostOf.get(row.sessionId) ?? "",
          shared: row.shared,
          attended: true,
        }),
      )
      .map((row) => [
        row.sessionId,
        { shared: row.shared, transcript: row.transcript },
      ]),
  );
}

/** Deletes saved notes of sessions that started before a moment, with their attendance. */
export async function pruneSavedNotes(before: Date): Promise<number> {
  const old = db()
    .select({ id: meetingSession.id })
    .from(meetingSession)
    .where(lt(meetingSession.startedAt, before));
  const deleted = await db()
    .delete(meetingNotes)
    .where(inArray(meetingNotes.sessionId, old))
    .returning({ sessionId: meetingNotes.sessionId });
  return deleted.length;
}
