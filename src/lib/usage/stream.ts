import "server-only";

import { and, eq, gte, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { meetingSession, participantSession } from "@/lib/db/schema";

import { participantMinutes, utcMonth } from "./meters";

/**
 * Stream participant-minutes so far this month (UTC), from the attendance FaceOn keeps
 * of every call on Stream (webhooks: who connected, when they joined and left). It's
 * FaceOn's own count: Stream's dashboard is what's billed.
 */
export async function streamMinutesThisMonth(
  now = new Date(),
): Promise<number> {
  const month = utcMonth(now);
  const connections = await db()
    .select({
      joinedAt: participantSession.joinedAt,
      leftAt: participantSession.leftAt,
      endedAt: meetingSession.endedAt,
    })
    .from(participantSession)
    .innerJoin(
      meetingSession,
      eq(meetingSession.id, participantSession.sessionId),
    )
    .where(
      and(
        eq(meetingSession.provider, "stream"),
        lt(participantSession.joinedAt, month.end),
        or(
          isNull(participantSession.leftAt),
          gte(participantSession.leftAt, month.start),
        ),
      ),
    );
  return participantMinutes(connections, month, now);
}
