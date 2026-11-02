import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  meetingMember,
  meetingSession,
  participantSession,
  webhookEvent,
} from "@/lib/db/schema";
import type { AttendanceEvent } from "@/lib/media/types";

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

/** Drops webhook delivery IDs after a week; Stream retries only within minutes. */
export async function pruneWebhookEvents(before: Date): Promise<number> {
  const deleted = await db()
    .delete(webhookEvent)
    .where(sql`${webhookEvent.receivedAt} < ${before}`)
    .returning({ id: webhookEvent.id });
  return deleted.length;
}
