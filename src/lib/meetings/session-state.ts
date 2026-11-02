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
    "hands" | "rev" | "policy" | "spotlight" | "notes"
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
  /** AI notes went on (who, when) or off. */
  | { notes: NotesState | null };

function updatesFor(change: SessionChange, now: Date) {
  const { hands, policy, spotlight } = meetingSession;
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
  if ("notes" in change) return { notes: change.notes };
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
 */
export async function changeSession(
  meeting: Meeting,
  session: MeetingSession,
  change: SessionChange,
): Promise<SessionState> {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${session.id}))`,
    );
    const [row] = await tx
      .update(meetingSession)
      .set({
        ...updatesFor(change, new Date()),
        rev: sql`${meetingSession.rev} + 1`,
      })
      .where(eq(meetingSession.id, session.id))
      .returning();
    if (!row) throw new Error("The session is gone.");
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
    const state = sessionState(
      meeting,
      row,
      cohosts.map((c) => c.id),
    );
    await mediaProvider(session.provider).setSessionState(session.id, state);
    return state;
  });
}
