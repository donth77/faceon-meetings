import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { meetingSession } from "@/lib/db/schema";
import { mediaProvider } from "@/lib/media";
import type { SessionState } from "@/lib/media/types";

import type { Meeting, MeetingSession } from "./queries";

/** The complete shared state of a session, as every participant receives it. */
export function sessionState(
  meeting: Meeting,
  session: Pick<MeetingSession, "hands" | "rev">,
): SessionState {
  return {
    rev: session.rev,
    locked: false,
    chat: meeting.settings.chat,
    reactions: meeting.settings.reactions,
    screenShare: meeting.settings.screenShare,
    hands: session.hands,
  };
}

export type HandChange =
  { raise: string } | { lower: string } | { lowerAll: true };

function handsAfter(change: HandChange, now: Date) {
  const hands = meetingSession.hands;
  if ("lowerAll" in change) return sql`'{}'::jsonb`;
  if ("lower" in change) return sql`${hands} - ${change.lower}::text`;
  // A hand that's already up keeps its place in the queue.
  return sql`case when jsonb_exists(${hands}, ${change.raise}::text) then ${hands}
    else ${hands} || jsonb_build_object(${change.raise}::text, ${now.toISOString()}::text) end`;
}

/**
 * Raises or lowers hands, then publishes the session's state. One writer per session at
 * a time (an advisory lock), so updates reach the provider in order and none is lost.
 */
export async function changeHands(
  meeting: Meeting,
  session: MeetingSession,
  change: HandChange,
): Promise<SessionState> {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${session.id}))`,
    );
    const [row] = await tx
      .update(meetingSession)
      .set({
        hands: handsAfter(change, new Date()),
        rev: sql`${meetingSession.rev} + 1`,
      })
      .where(eq(meetingSession.id, session.id))
      .returning({ hands: meetingSession.hands, rev: meetingSession.rev });
    if (!row) throw new Error("The session is gone.");
    const state = sessionState(meeting, row);
    await mediaProvider(session.provider).setSessionState(session.id, state);
    return state;
  });
}
