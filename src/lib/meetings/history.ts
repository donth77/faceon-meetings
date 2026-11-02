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

import { attendedBy } from "./queries";
import { notesInPrevious } from "./saved-notes";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Someone who came to a past meeting, with their first join and last leave. */
export type Attendee = {
  name: string;
  image: string | null;
  /** Each time they joined and left, when they came more than once. */
  visits: Array<{ joinedAt: string; leftAt: string }>;
  isHost: boolean;
  isGuest: boolean;
  isYou: boolean;
  joinedAt: string;
  leftAt: string;
  minutes: number;
};

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

const minutesBetween = (from: Date, to: Date) =>
  Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));

/**
 * Previous: sessions from the last 90 days that someone hosted or attended, newest
 * first, with who came and for how long (from the media provider's webhooks, or from
 * admissions when no attendance arrived).
 */
export async function previousMeetings(viewer: {
  id: string;
}): Promise<PastMeeting[]> {
  const since = new Date(Date.now() - 90 * DAY_MS);
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

  return sessions.map(({ session, meeting: row, hostName }) => {
    const sessionEnd = session.endedAt ?? session.startedAt;
    const people = new Map<string, Attendee & { joined: Date; left: Date }>();
    const roleOf = (mediaUserId: string) =>
      members.find(
        (m) => m.sessionId === session.id && m.mediaUserId === mediaUserId,
      );
    const add = (
      mediaUserId: string,
      name: string,
      image: string | null,
      joined: Date,
      left: Date,
    ) => {
      // Admission times come from the database's clock and ends from the app's; a
      // few seconds apart can't put the leave before the join.
      if (left < joined) left = joined;
      const member = roleOf(mediaUserId);
      const current = people.get(mediaUserId);
      const minutes = minutesBetween(joined, left);
      const visit = {
        joinedAt: joined.toISOString(),
        leftAt: left.toISOString(),
      };
      if (current) {
        current.visits.push(visit);
        current.joined = joined < current.joined ? joined : current.joined;
        current.left = left > current.left ? left : current.left;
        current.minutes += minutes;
        return;
      }
      people.set(mediaUserId, {
        name,
        image,
        isHost: member?.role === "host",
        isGuest: mediaUserId.startsWith("g_"),
        isYou: member?.userId === viewer.id,
        visits: [visit],
        joinedAt: "",
        leftAt: "",
        minutes,
        joined,
        left,
      });
    };

    const own = connections.filter((c) => c.sessionId === session.id);
    if (own.length > 0) {
      for (const c of own) {
        add(
          c.mediaUserId,
          c.displayName,
          imageOf(
            c.userId,
            c.image ??
              members.find(
                (m) =>
                  m.sessionId === session.id && m.mediaUserId === c.mediaUserId,
              )?.image ??
              null,
          ),
          c.joinedAt,
          c.leftAt ?? sessionEnd,
        );
      }
    } else {
      for (const m of members.filter((m) => m.sessionId === session.id)) {
        add(
          m.mediaUserId,
          m.displayName,
          imageOf(m.userId, m.image),
          m.admittedAt,
          sessionEnd,
        );
      }
    }

    const list = [...people.values()]
      .sort((a, b) => a.joined.getTime() - b.joined.getTime())
      .map(({ joined, left, visits, ...person }) => ({
        ...person,
        // One visit says no more than joined and left do.
        visits:
          visits.length > 1
            ? visits.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
            : [],
        joinedAt: joined.toISOString(),
        leftAt: left.toISOString(),
      }));
    const start = list.length
      ? new Date(Math.min(...list.map((p) => new Date(p.joinedAt).getTime())))
      : session.startedAt;
    const end = list.length
      ? new Date(Math.max(...list.map((p) => new Date(p.leftAt).getTime())))
      : sessionEnd;

    return {
      sessionId: session.id,
      code: row.code,
      title: row.title,
      hostName,
      hostedByYou: row.hostId === viewer.id,
      recurring: series.some((s) => s.meetingId === row.id),
      start: start.toISOString(),
      end: end.toISOString(),
      minutes: minutesBetween(start, end),
      attendees: list,
      notes: notes.get(session.id) ?? null,
    };
  });
}
