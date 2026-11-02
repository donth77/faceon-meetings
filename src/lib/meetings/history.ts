import "server-only";

import { and, desc, eq, gt, inArray, or } from "drizzle-orm";

import { avatarUrl } from "@/lib/avatars/seed";
import { db } from "@/lib/db";
import {
  meeting,
  meetingMember,
  meetingRule,
  meetingSession,
  participantSession,
  user,
} from "@/lib/db/schema";

import {
  attendeesOf,
  minutesBetween,
  type Attendee,
  type Visit,
} from "./attendees";
import { userMediaId } from "./principal";
import { attendedBy } from "./queries";
import { daysBefore, KEEP_DAYS } from "./retention";
import { notesInPrevious } from "./saved-notes";

export type { Attendee } from "./attendees";

/** A past meeting for Previous, ready for the browser (times in ISO 8601). */
export type PastMeeting = {
  sessionId: string;
  code: string;
  title: string | null;
  hostName: string;
  hostedByYou: boolean;
  recurring: boolean;
  start: string;
  end: string;
  minutes: number;
  attendees: Attendee[];
  /** AI notes saved to the meeting that you may read, and whether they're shared. */
  notes: { shared: boolean } | null;
};

/**
 * Previous: sessions from the last 90 days that someone hosted or attended, newest
 * first, with who came and for how long (from the media provider's webhooks, or from
 * admissions when no attendance arrived).
 */
export async function previousMeetings(viewer: {
  id: string;
}): Promise<PastMeeting[]> {
  const since = daysBefore(new Date(), KEEP_DAYS.history);
  const attended = or(eq(meeting.hostId, viewer.id), attendedBy(viewer.id));
  const sessions = await db()
    .select({
      session: meetingSession,
      meeting,
      hostName: user.name,
    })
    .from(meetingSession)
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(
      and(
        eq(meetingSession.status, "ended"),
        gt(meetingSession.startedAt, since),
        attended,
      ),
    )
    .orderBy(desc(meetingSession.startedAt))
    .limit(200);
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.session.id);
  const meetingIds = [...new Set(sessions.map((s) => s.meeting.id))];
  const [connections, members, series, notes] = await Promise.all([
    db()
      .select()
      .from(participantSession)
      .where(inArray(participantSession.sessionId, ids)),
    db()
      .select()
      .from(meetingMember)
      .where(inArray(meetingMember.sessionId, ids)),
    db()
      .select({ meetingId: meetingRule.meetingId })
      .from(meetingRule)
      .where(inArray(meetingRule.meetingId, meetingIds)),
    notesInPrevious(
      sessions.map((s) => ({ id: s.session.id, hostId: s.meeting.hostId })),
      viewer.id,
    ),
  ]);

  // Signed-in people show their avatar as it is now; guests keep the one they had.
  const userIds = [
    ...new Set(
      [...connections, ...members]
        .map((row) => row.userId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const avatars = new Map(
    userIds.length
      ? (
          await db()
            .select({
              id: user.id,
              image: user.image,
              avatarSeed: user.avatarSeed,
              avatarSource: user.avatarSource,
            })
            .from(user)
            .where(inArray(user.id, userIds))
        ).map((row) => [row.id, avatarUrl(row)] as const)
      : [],
  );
  const imageOf = (userId: string | null, stored: string | null) =>
    (userId ? avatars.get(userId) : undefined) ?? stored;
  const viewerMediaId = userMediaId(viewer.id);

  return sessions.map(({ session, meeting: row, hostName }) => {
    const sessionEnd = session.endedAt ?? session.startedAt;
    const admitted = members.filter((m) => m.sessionId === session.id);
    const own = connections.filter((c) => c.sessionId === session.id);
    const visits: Visit[] =
      own.length > 0
        ? own.map((c) => ({
            mediaUserId: c.mediaUserId,
            name: c.displayName,
            image: imageOf(
              c.userId,
              c.image ??
                admitted.find((m) => m.mediaUserId === c.mediaUserId)?.image ??
                null,
            ),
            joinedAt: c.joinedAt,
            leftAt: c.leftAt ?? sessionEnd,
          }))
        : admitted.map((m) => ({
            mediaUserId: m.mediaUserId,
            name: m.displayName,
            image: imageOf(m.userId, m.image),
            joinedAt: m.admittedAt,
            leftAt: sessionEnd,
          }));
    const { attendees, start, end } = attendeesOf(visits, {
      viewerMediaId,
      hostMediaId: userMediaId(row.hostId),
    });
    const from = start ?? session.startedAt;
    const to = end ?? sessionEnd;

    return {
      sessionId: session.id,
      code: row.code,
      title: row.title,
      hostName,
      hostedByYou: row.hostId === viewer.id,
      recurring: series.some((s) => s.meetingId === row.id),
      start: from.toISOString(),
      end: to.toISOString(),
      minutes: minutesBetween(from, to),
      attendees,
      notes: notes.get(session.id) ?? null,
    };
  });
}
