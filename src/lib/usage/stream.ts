import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  or,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { meetingSession, participantSession } from "@/lib/db/schema";

import { attendanceMissing, participantMinutes, utcMonth } from "./meters";

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

/** Calls looked at for missing attendance: the latest few, in case the very latest was short. */
const LATEST_CALLS = 5;

/**
 * Whether the latest call on Stream that ran a minute or more has no attendance
 * (`attendanceMissing`): Stream's webhook isn't reaching FaceOn, so the minutes above
 * and Previous miss its calls.
 */
export async function streamAttendanceMissing(): Promise<boolean> {
  const calls = await db()
    .select({
      startedAt: meetingSession.startedAt,
      endedAt: meetingSession.endedAt,
      connections: count(participantSession.id),
    })
    .from(meetingSession)
    .leftJoin(
      participantSession,
      eq(participantSession.sessionId, meetingSession.id),
    )
    .where(
      and(
        eq(meetingSession.provider, "stream"),
        isNotNull(meetingSession.endedAt),
      ),
    )
    .groupBy(meetingSession.id)
    .orderBy(desc(meetingSession.endedAt))
    .limit(LATEST_CALLS);
  return attendanceMissing(
    calls.flatMap(({ endedAt, ...call }) =>
      endedAt ? [{ ...call, endedAt }] : [],
    ),
  );
}
