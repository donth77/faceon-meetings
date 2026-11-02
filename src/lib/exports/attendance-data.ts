import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { meetingInvitee, user } from "@/lib/db/schema";
import { groupVisits, type PersonVisits } from "@/lib/meetings/attendees";
import { pastSessions, type PastSession } from "@/lib/meetings/history";
import { userMediaId } from "@/lib/meetings/principal";
import { isUuid } from "@/lib/uuid";

import { shownEmail } from "./attendance";

/** A past session's people as a reader may see them, with the emails they may see. */
export type SessionAttendance = {
  session: PastSession;
  hostedByReader: boolean;
  hostMediaId: string;
  people: PersonVisits[];
  /** By media ID: only the reader's own address, and invitees' in meetings they host. */
  emails: ReadonlyMap<string, string>;
};

type Reader = { id: string; email: string };

/** Each session's attendance as `reader` may see it (shownEmail decides the emails). */
export async function attendanceOf(
  sessions: PastSession[],
  reader: Reader,
): Promise<SessionAttendance[]> {
  // Invitees and attendees' account addresses matter only where the reader hosts.
  const hosted = sessions.filter((s) => s.meeting.hostId === reader.id);
  const meetingIds = [...new Set(hosted.map((s) => s.meeting.id))];
  const userIds = [
    ...new Set(
      hosted
        .flatMap((s) => s.visits.map((visit) => visit.userId))
        .filter((id): id is string => id !== null),
    ),
  ];
  const [invitees, accounts] = await Promise.all([
    meetingIds.length
      ? db()
          .select({
            meetingId: meetingInvitee.meetingId,
            email: meetingInvitee.email,
          })
          .from(meetingInvitee)
          .where(inArray(meetingInvitee.meetingId, meetingIds))
      : [],
    userIds.length
      ? db()
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(inArray(user.id, userIds))
      : [],
  ]);
  const accountEmail = new Map(accounts.map((row) => [row.id, row.email]));
  const readerMediaId = userMediaId(reader.id);

  return sessions.map((session) => {
    const hostedByReader = session.meeting.hostId === reader.id;
    const invited = new Set(
      hostedByReader
        ? invitees
            .filter((row) => row.meetingId === session.meeting.id)
            .map((row) => row.email.toLowerCase())
        : [],
    );
    const accountOf = new Map(
      session.visits.map((visit) => [visit.mediaUserId, visit.userId]),
    );
    const people = groupVisits(session.visits);
    const emails = new Map<string, string>();
    for (const person of people) {
      const userId = accountOf.get(person.mediaUserId) ?? null;
      const email = shownEmail({
        mediaUserId: person.mediaUserId,
        accountEmail: userId ? (accountEmail.get(userId) ?? null) : null,
        invited,
        readerMediaId,
        readerEmail: reader.email,
      });
      if (email) emails.set(person.mediaUserId, email);
    }
    return {
      session,
      hostedByReader,
      hostMediaId: userMediaId(session.meeting.hostId),
      people,
      emails,
    };
  });
}

/** A past session's attendance for its host; null for anyone else, or no such session. */
export async function hostAttendance(
  sessionId: string,
  reader: Reader,
): Promise<SessionAttendance | null> {
  if (!isUuid(sessionId)) return null;
  const [session] = await pastSessions(reader.id, { limit: 1, sessionId });
  if (!session || session.meeting.hostId !== reader.id) return null;
  const [attendance] = await attendanceOf([session], reader);
  return attendance ?? null;
}
