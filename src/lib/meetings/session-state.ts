import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { meetingMember, meetingSession } from "@/lib/db/schema";
import { mediaProvider } from "@/lib/media";
import type { NotesState, SessionState } from "@/lib/media/types";

import { policyFromSettings, type SessionPolicy } from "./policy";
import { userMediaId } from "./principal";
import type { Meeting, MeetingSession } from "./queries";

/** The session's policies: the meeting's settings, with the hosts' changes on top. */
export function sessionPolicy(
  meeting: Meeting,
  session: Pick<MeetingSession, "policy">,
): SessionPolicy {
  return { ...policyFromSettings(meeting.settings), ...session.policy };
}

/** The complete shared state of a session, as every participant receives it. */
export function sessionState(
  meeting: Meeting,
  session: Pick<
    MeetingSession,
    | "hands"
    | "rev"
    | "policy"
    | "spotlight"
    | "notes"
    | "notesAllowed"
    | "notesStopped"
  >,
  cohosts: string[],
): SessionState {
  return {
    rev: session.rev,
    ...sessionPolicy(meeting, session),
    host: userMediaId(meeting.hostId),
    cohosts,
    spotlight: session.spotlight,
    hands: session.hands,
    notes: session.notes ?? null,
    notesAllowed: session.notesAllowed,
    notesStopped: session.notesStopped,
    shareNotes: meeting.settings.shareNotes,
  };
}

export type SessionChange =
  | { raise: string }
  | { lower: string }
  | { lowerAll: true }
  | { policy: Partial<SessionPolicy> }
  | { spotlight: string | null }
  /** Someone was removed: their hand goes down and their spotlight ends. */
  | { forget: string }
  /** Someone became, or stopped being, a co-host. */
  | { roles: true }
  /**
   * AI notes went on: who and when. If they're already on, they stay whose they were.
   * `auto`: started by themselves as someone joined, which a stop earlier in the
   * session prevents; started by hand, they clear that stop.
   */
  | { notesOn: NotesState; auto?: boolean }
  /** Someone stopped AI notes, so they don't start again by themselves this session. */
  | { notesOff: true }
  /** Someone's last connection left: AI notes go off if they were taking them. */
  | { notesOffFrom: string }
  /** The host allowed AI notes in their meetings, or stopped allowing them (and any on stop). */
  | { notesAllowed: boolean }
  /** The meeting's own settings changed (sharing AI notes): everyone gets them again. */
  | { meetingSettings: true };

/** Allowing AI notes, or not: not allowing them also stops notes in progress. */
function allowingNotes(
  allowed: boolean,
): Pick<MeetingSession, "notesAllowed"> &
  Partial<Pick<MeetingSession, "notes">> {
  return allowed
    ? { notesAllowed: true }
    : { notesAllowed: false, notes: null };
}

/**
 * The change as SQL on the row as it is under the lock, so each one is decided on the
 * latest state, not on what the caller read before (two hosts at once, say).
 */
function updatesFor(change: SessionChange, now: Date) {
  const { hands, notes, notesStopped, policy, spotlight } = meetingSession;
  if ("lowerAll" in change) return { hands: sql`'{}'::jsonb` };
  if ("lower" in change) {
    return { hands: sql`${hands} - ${change.lower}::text` };
  }
  if ("raise" in change) {
    // A hand that's already up keeps its place in the queue.
    return {
      hands: sql`case when jsonb_exists(${hands}, ${change.raise}::text) then ${hands}
        else ${hands} || jsonb_build_object(${change.raise}::text, ${now.toISOString()}::text) end`,
    };
  }
  if ("policy" in change) {
    return {
      policy: sql`${policy} || ${JSON.stringify(change.policy)}::jsonb`,
    };
  }
  if ("spotlight" in change) return { spotlight: change.spotlight };
  if ("notesOn" in change) {
    const on = sql`coalesce(${notes}, ${JSON.stringify(change.notesOn)}::jsonb)`;
    return change.auto
      ? { notes: sql`case when ${notesStopped} then ${notes} else ${on} end` }
      : { notes: on, notesStopped: false };
  }
  if ("notesOff" in change) return { notes: null, notesStopped: true };
  if ("notesAllowed" in change) return allowingNotes(change.notesAllowed);
  if ("notesOffFrom" in change) {
    return {
      notes: sql`case when ${notes}->>'by' = ${change.notesOffFrom}::text then null else ${notes} end`,
    };
  }
  if ("forget" in change) {
    return {
      hands: sql`${hands} - ${change.forget}::text`,
      spotlight: sql`nullif(${spotlight}, ${change.forget}::text)`,
    };
  }
  return {};
}

/**
 * Changes the session's shared state, then publishes all of it. One writer per session at
 * a time (an advisory lock), so updates reach the provider in order and none is lost.
 * Returns the state just before the change too, as read under the lock.
 */
export async function changeSessionFrom(
  meeting: Meeting,
  session: MeetingSession,
  change: SessionChange,
): Promise<{ before: SessionState; after: SessionState }> {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${session.id}))`,
    );
    const [previous] = await tx
      .select()
      .from(meetingSession)
      .where(eq(meetingSession.id, session.id))
      .limit(1);
    const [row] = await tx
      .update(meetingSession)
      .set({
        ...updatesFor(change, new Date()),
        rev: sql`${meetingSession.rev} + 1`,
      })
      .where(eq(meetingSession.id, session.id))
      .returning();
    if (!previous || !row) throw new Error("The session is gone.");
    const cohosts = await tx
      .select({ id: meetingMember.mediaUserId })
      .from(meetingMember)
      .where(
        and(
          eq(meetingMember.sessionId, session.id),
          eq(meetingMember.role, "cohost"),
          isNull(meetingMember.bannedAt),
        ),
      );
    const ids = cohosts.map((c) => c.id);
    const after = sessionState(meeting, row, ids);
    await mediaProvider(session.provider).setSessionState(session.id, after);
    return { before: sessionState(meeting, previous, ids), after };
  });
}

/** Changes the session's shared state (see changeSessionFrom); returns the new state. */
export async function changeSession(
  meeting: Meeting,
  session: MeetingSession,
  change: SessionChange,
): Promise<SessionState> {
  return (await changeSessionFrom(meeting, session, change)).after;
}

/**
 * Whether the host allows AI notes, stored without publishing: for when publishing
 * failed, so the server holds to it now and the session's next change publishes it.
 */
export async function storeNotesAllowed(
  sessionId: string,
  allowed: boolean,
): Promise<void> {
  await db()
    .update(meetingSession)
    .set(allowingNotes(allowed))
    .where(eq(meetingSession.id, sessionId));
}
