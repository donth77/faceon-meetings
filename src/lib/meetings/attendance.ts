import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  meeting,
  meetingMember,
  meetingSession,
  participantSession,
  webhookEvent,
} from "@/lib/db/schema";
import type { AttendanceEvent } from "@/lib/media/types";

import { readMeeting } from "./queries";
import { changeSession } from "./session-state";

/**
 * Records attendance from a webhook delivery, once: the delivery's ID is stored in the
 * same transaction, so a retry or a replay changes nothing.
 */
export async function recordAttendance(
  deliveryId: string,
  event: AttendanceEvent | null,
): Promise<"recorded" | "duplicate" | "ignored"> {
  return db().transaction(async (tx) => {
    const [fresh] = await tx
      .insert(webhookEvent)
      .values({ id: deliveryId })
      .onConflictDoNothing()
      .returning({ id: webhookEvent.id });
    if (!fresh) return "duplicate";
    if (!event) return "ignored";

    const [session] = await tx
      .select({ id: meetingSession.id })
      .from(meetingSession)
      .where(eq(meetingSession.id, event.sessionId))
      .limit(1);
    if (!session) return "ignored";

    if (event.type === "joined") {
      const [member] = await tx
        .select({ userId: meetingMember.userId })
        .from(meetingMember)
        .where(
          and(
            eq(meetingMember.sessionId, session.id),
            eq(meetingMember.mediaUserId, event.mediaUserId),
          ),
        )
        .limit(1);
      await tx
        .insert(participantSession)
        .values({
          sessionId: session.id,
          connectionId: event.connectionId,
          mediaUserId: event.mediaUserId,
          userId: member?.userId ?? null,
          displayName: event.name,
          image: event.image,
          joinedAt: event.at,
        })
        .onConflictDoNothing();
      return "recorded";
    }

    await tx
      .update(participantSession)
      .set({ leftAt: event.at })
      .where(
        and(
          eq(participantSession.connectionId, event.connectionId),
          isNull(participantSession.leftAt),
        ),
      );
    return "recorded";
  });
}

/**
 * Deletes who joined and left once it's older than Previous shows (90 days), as the
 * privacy policy promises.
 */
export async function pruneAttendance(before: Date): Promise<number> {
  const deleted = await db()
    .delete(participantSession)
    .where(
      sql`coalesce(${participantSession.leftAt}, ${participantSession.joinedAt}) < ${before}`,
    )
    .returning({ id: participantSession.id });
  return deleted.length;
}

/** Drops webhook delivery IDs after a week; Stream retries only within minutes. */
export async function pruneWebhookEvents(before: Date): Promise<number> {
  const deleted = await db()
    .delete(webhookEvent)
    .where(sql`${webhookEvent.receivedAt} < ${before}`)
    .returning({ id: webhookEvent.id });
  return deleted.length;
}

/**
 * Someone left: their raised hand goes down once their last connection has gone, as in
 * Meet. (Another tab or device keeps it up.) Coming back, they start with it down.
 */
export async function lowerHandOnLeave(event: AttendanceEvent): Promise<void> {
  if (event.type !== "left") return;
  // The event names the connection; its row says whose it was.
  const [left] = await db()
    .select({ mediaUserId: participantSession.mediaUserId })
    .from(participantSession)
    .where(eq(participantSession.connectionId, event.connectionId))
    .limit(1);
  if (!left) return;
  const [stillHere] = await db()
    .select({ id: participantSession.id })
    .from(participantSession)
    .where(
      and(
        eq(participantSession.sessionId, event.sessionId),
        eq(participantSession.mediaUserId, left.mediaUserId),
        isNull(participantSession.leftAt),
      ),
    )
    .limit(1);
  if (stillHere) return;
  const [row] = await db()
    .select({ session: meetingSession, meeting })
    .from(meetingSession)
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .where(eq(meetingSession.id, event.sessionId))
    .limit(1);
  if (!row || row.session.status !== "open") return;
  if (!(left.mediaUserId in (row.session.hands ?? {}))) return;
  await changeSession(readMeeting(row.meeting), row.session, {
    lower: left.mediaUserId,
  });
}
