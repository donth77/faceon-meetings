import "server-only";

import { aliasedTable, and, asc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  meeting,
  meetingInvitee,
  meetingMember,
  meetingNotes,
  meetingSession,
  user,
} from "@/lib/db/schema";
import {
  isGuestMediaId,
  minutesBetween,
  spanOf,
} from "@/lib/meetings/attendees";
import { pastSessions } from "@/lib/meetings/history";
import { attendedBy } from "@/lib/meetings/queries";
import type { MeetingNotes } from "@/lib/notes/notes";

import { attendanceOf } from "./attendance-data";

/** A person in a past meeting, as the reader may see them. Times in ISO 8601. */
export type ExportedPerson = {
  name: string;
  /** Only the reader's own, and invitees' in meetings the reader hosts. */
  email: string | null;
  joinedAs: "host" | "account" | "guest";
  firstJoined: string;
  lastLeft: string;
  minutes: number;
  visits: Array<{ joinedAt: string; leftAt: string }>;
};

/** A past meeting the reader hosted or was in, with who came. Times in ISO 8601. */
export type PreviousEntry = {
  meetingId: string;
  title: string | null;
  hostName: string;
  hostedByYou: boolean;
  yourRole: "host" | "cohost" | "participant";
  start: string;
  end: string;
  /** From the first to arrive to the last to leave, as Previous shows it. */
  minutes: number;
  people: ExportedPerson[];
};

/** Saved AI notes the reader may read, with their transcript where it was saved. */
export type NoteEntry = {
  meetingId: string;
  title: string | null;
  hostName: string;
  start: string;
  end: string;
  savedByYou: boolean;
  shared: boolean;
  madeWith: string;
  provider: string | null;
  madeAt: string;
  savedAt: string;
  notes: MeetingNotes;
  transcript: string | null;
};

/** Meeting history, as Previous holds it: the meetings, who came, and the AI notes. */
export type HistoryData = { previous: PreviousEntry[]; notes: NoteEntry[] };

const iso = (date: Date) => date.toISOString();

type Reader = { id: string; email: string };

/**
 * The reader's meeting history from the last 90 days (what Previous lists), with who came
 * on the export's email rule, their own role in each, and the AI notes they may read.
 */
export async function historyData(reader: Reader): Promise<HistoryData> {
  const [past, notes, namedCohost] = await Promise.all([
    pastSessions(reader.id, { limit: null }),
    readableNotes(reader.id),
    db()
      .select({ meetingId: meetingInvitee.meetingId })
      .from(meetingInvitee)
      .where(
        and(
          eq(sql`lower(${meetingInvitee.email})`, reader.email.toLowerCase()),
          eq(meetingInvitee.cohost, true),
        ),
      ),
  ]);
  const sessionIds = past.map((p) => p.session.id);
  const [attendance, roles] = await Promise.all([
    attendanceOf(past, reader),
    sessionIds.length
      ? db()
          .select({
            sessionId: meetingMember.sessionId,
            role: meetingMember.role,
          })
          .from(meetingMember)
          .where(
            and(
              inArray(meetingMember.sessionId, sessionIds),
              eq(meetingMember.userId, reader.id),
            ),
          )
      : [],
  ]);
  const named = new Set(namedCohost.map((row) => row.meetingId));

  return {
    previous: attendance.map(
      ({ session: entry, people, emails, hostMediaId }) => {
        const sessionEnd = entry.session.endedAt ?? entry.session.startedAt;
        const { start, end } = spanOf(people);
        const from = start ?? entry.session.startedAt;
        const to = end ?? sessionEnd;
        const cohost =
          named.has(entry.meeting.id) ||
          roles.some(
            (row) =>
              row.sessionId === entry.session.id && row.role === "cohost",
          );
        return {
          meetingId: entry.meeting.code,
          title: entry.meeting.title,
          hostName: entry.hostName,
          hostedByYou: entry.meeting.hostId === reader.id,
          yourRole:
            entry.meeting.hostId === reader.id
              ? "host"
              : cohost
                ? "cohost"
                : "participant",
          start: iso(from),
          end: iso(to),
          minutes: minutesBetween(from, to),
          people: people.map((who) => ({
            name: who.name,
            email: emails.get(who.mediaUserId) ?? null,
            joinedAs:
              who.mediaUserId === hostMediaId
                ? "host"
                : isGuestMediaId(who.mediaUserId)
                  ? "guest"
                  : "account",
            firstJoined: iso(who.joined),
            lastLeft: iso(who.left),
            minutes: who.minutes,
            visits: who.visits,
          })),
        };
      },
    ),
    notes,
  };
}

/** The AI notes someone may read: theirs, their meetings', and shared ones they were in. */
async function readableNotes(readerId: string): Promise<NoteEntry[]> {
  const host = aliasedTable(user, "host");
  const rows = await db()
    .select({
      notes: meetingNotes,
      session: meetingSession,
      code: meeting.code,
      title: meeting.title,
      hostName: host.name,
    })
    .from(meetingNotes)
    .innerJoin(meetingSession, eq(meetingSession.id, meetingNotes.sessionId))
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .innerJoin(host, eq(host.id, meeting.hostId))
    .where(
      or(
        eq(meetingNotes.savedBy, readerId),
        eq(meeting.hostId, readerId),
        and(eq(meetingNotes.shared, true), attendedBy(readerId)),
      ),
    )
    .orderBy(asc(meetingSession.startedAt));
  return rows.map((row) => ({
    meetingId: row.code,
    title: row.title,
    hostName: row.hostName,
    start: iso(row.session.startedAt),
    end: iso(row.session.endedAt ?? row.notes.madeAt),
    savedByYou: row.notes.savedBy === readerId,
    shared: row.notes.shared,
    madeWith: row.notes.engine,
    provider: row.notes.provider,
    madeAt: iso(row.notes.madeAt),
    savedAt: iso(row.notes.savedAt),
    notes: row.notes.notes,
    transcript: row.notes.transcript,
  }));
}
