import "server-only";

import { aliasedTable, and, asc, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  account,
  hostAllowlist,
  hostingRequest,
  meeting,
  meetingException,
  meetingInvitee,
  meetingNotes,
  meetingRule,
  meetingSession,
  session,
  user,
} from "@/lib/db/schema";
import { hostingPlanOf } from "@/lib/hosting/access";
import { isGuestMediaId } from "@/lib/meetings/attendees";
import { pastSessions } from "@/lib/meetings/history";
import { approvedBySettings, isAdmin } from "@/lib/meetings/hosting";
import { attendedBy } from "@/lib/meetings/queries";
import type { MeetingSettings } from "@/lib/meetings/settings";
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

/** Everything "Download your data" holds, before it's written out. Times in ISO 8601. */
export type YourData = {
  generatedAt: string;
  account: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
    language: string | null;
    picture: {
      source: string | null;
      avatarSeed: string | null;
      photo: string | null;
    };
    aiNotesInMeetingsYouHost: boolean;
    scheduleDefaults: unknown;
    signInMethods: Array<{
      provider: string;
      connectedAt: string;
      permissions: string[];
    }>;
    sessions: Array<{
      startedAt: string;
      expiresAt: string;
      ipAddress: string | null;
      browser: string | null;
    }>;
  };
  hosting: {
    access: "admin" | "full" | "demo";
    approvedInSettings: boolean;
    approval: {
      approvedAt: string;
      approvedBy: string | null;
      note: string | null;
    } | null;
    requests: Array<{
      note: string | null;
      status: string;
      askedAt: string;
      answeredAt: string | null;
      answeredBy: string | null;
    }>;
  };
  meetings: Array<{
    meetingId: string;
    type: "instant" | "scheduled" | "personal";
    status: string;
    madeIn: "faceon" | "google_addon";
    title: string | null;
    description: string | null;
    passcode: string | null;
    settings: MeetingSettings;
    startsAt: string | null;
    durationMinutes: number | null;
    timeZone: string | null;
    repeats: {
      rule: string;
      firstStart: string;
      lastStart: string | null;
      durationMinutes: number;
      timeZone: string;
    } | null;
    changedOccurrences: Array<{
      originalStart: string;
      cancelled: boolean;
      startsAt: string | null;
      durationMinutes: number | null;
      title: string | null;
    }>;
    invitees: Array<{ email: string; cohost: boolean }>;
    onGoogleCalendar: boolean;
    createdAt: string;
  }>;
  previous: Array<{
    meetingId: string;
    title: string | null;
    hostName: string;
    hostedByYou: boolean;
    start: string;
    end: string;
    people: ExportedPerson[];
  }>;
  notes: Array<{
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
  }>;
};

const iso = (date: Date) => date.toISOString();
const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

/**
 * Everything kept about someone that they may see, for Settings → Account's "Download
 * your data". Sign-in tokens and the password's hash are left out: they're secrets that
 * only sign in.
 */
export async function yourData(reader: {
  id: string;
  email: string;
  emailVerified: boolean;
}): Promise<YourData> {
  const decider = aliasedTable(user, "decider");
  const adder = aliasedTable(user, "adder");
  const host = aliasedTable(user, "host");
  const [
    [person],
    methods,
    sessions,
    hosted,
    [approval],
    requests,
    notes,
    past,
    plan,
  ] = await Promise.all([
    db().select().from(user).where(eq(user.id, reader.id)).limit(1),
    db()
      .select({
        provider: account.providerId,
        connectedAt: account.createdAt,
        scope: account.scope,
      })
      .from(account)
      .where(eq(account.userId, reader.id))
      .orderBy(asc(account.createdAt)),
    db()
      .select({
        startedAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        browser: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, reader.id))
      .orderBy(desc(session.createdAt)),
    db()
      .select()
      .from(meeting)
      .where(eq(meeting.hostId, reader.id))
      .orderBy(asc(meeting.createdAt)),
    db()
      .select({
        approvedAt: hostAllowlist.createdAt,
        approvedBy: adder.name,
        note: hostAllowlist.note,
      })
      .from(hostAllowlist)
      .leftJoin(adder, eq(adder.id, hostAllowlist.addedBy))
      .where(eq(hostAllowlist.email, reader.email.toLowerCase()))
      .limit(1),
    db()
      .select({
        note: hostingRequest.note,
        status: hostingRequest.status,
        askedAt: hostingRequest.createdAt,
        answeredAt: hostingRequest.decidedAt,
        answeredBy: decider.name,
      })
      .from(hostingRequest)
      .leftJoin(decider, eq(decider.id, hostingRequest.decidedBy))
      .where(eq(hostingRequest.userId, reader.id))
      .orderBy(asc(hostingRequest.createdAt)),
    // The AI notes the reader may read: theirs, their meetings', and shared ones they were in.
    db()
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
          eq(meetingNotes.savedBy, reader.id),
          eq(meeting.hostId, reader.id),
          and(eq(meetingNotes.shared, true), attendedBy(reader.id)),
        ),
      )
      .orderBy(asc(meetingSession.startedAt)),
    pastSessions(reader.id, { limit: null }),
    hostingPlanOf(reader),
  ]);
  if (!person) throw new Error("The account to export wasn't found.");

  const meetingIds = hosted.map((row) => row.id);
  const [rules, exceptions, invitees] = meetingIds.length
    ? await Promise.all([
        db()
          .select()
          .from(meetingRule)
          .where(inArray(meetingRule.meetingId, meetingIds)),
        db()
          .select()
          .from(meetingException)
          .where(inArray(meetingException.meetingId, meetingIds))
          .orderBy(asc(meetingException.originalStart)),
        db()
          .select()
          .from(meetingInvitee)
          .where(inArray(meetingInvitee.meetingId, meetingIds))
          .orderBy(asc(meetingInvitee.addedAt)),
      ])
    : [[], [], []];
  const attendance = await attendanceOf(past, reader);

  return {
    generatedAt: iso(new Date()),
    account: {
      id: person.id,
      name: person.name,
      email: person.email,
      emailVerified: person.emailVerified,
      createdAt: iso(person.createdAt),
      language: person.locale,
      picture: {
        source: person.avatarSource,
        avatarSeed: person.avatarSeed,
        photo: person.image,
      },
      aiNotesInMeetingsYouHost: person.aiNotes,
      scheduleDefaults: person.scheduleDefaults ?? null,
      signInMethods: methods.map((method) => ({
        provider: method.provider,
        connectedAt: iso(method.connectedAt),
        permissions: (method.scope ?? "")
          .split(/[\s,]+/)
          .filter((scope) => scope !== ""),
      })),
      sessions: sessions.map((row) => ({
        startedAt: iso(row.startedAt),
        expiresAt: iso(row.expiresAt),
        ipAddress: row.ipAddress,
        browser: row.browser,
      })),
    },
    hosting: {
      access: isAdmin(reader) ? "admin" : plan,
      approvedInSettings: approvedBySettings(reader.email),
      approval: approval
        ? {
            approvedAt: iso(approval.approvedAt),
            approvedBy: approval.approvedBy,
            note: approval.note,
          }
        : null,
      requests: requests.map((request) => ({
        note: request.note,
        status: request.status,
        askedAt: iso(request.askedAt),
        answeredAt: isoOrNull(request.answeredAt),
        answeredBy: request.answeredBy,
      })),
    },
    meetings: hosted.map((row) => {
      const rule = rules.find((r) => r.meetingId === row.id);
      return {
        meetingId: row.code,
        type: row.type,
        status: row.status,
        madeIn: row.origin,
        title: row.title,
        description: row.description,
        passcode: row.passcode,
        settings: row.settings,
        startsAt: isoOrNull(row.startsAt),
        durationMinutes: row.durationMin,
        timeZone: row.timeZone,
        repeats: rule
          ? {
              rule: rule.rrule,
              firstStart: iso(rule.firstStart),
              lastStart: isoOrNull(rule.lastStart),
              durationMinutes: rule.durationMin,
              timeZone: rule.timeZone,
            }
          : null,
        changedOccurrences: exceptions
          .filter((change) => change.meetingId === row.id)
          .map((change) => ({
            originalStart: iso(change.originalStart),
            cancelled: change.cancelled,
            startsAt: isoOrNull(change.startsAt),
            durationMinutes: change.durationMin,
            title: change.title,
          })),
        invitees: invitees
          .filter((invitee) => invitee.meetingId === row.id)
          .map((invitee) => ({ email: invitee.email, cohost: invitee.cohost })),
        onGoogleCalendar:
          row.googleEventId !== null || row.googleEvents !== null,
        createdAt: iso(row.createdAt),
      };
    }),
    previous: attendance.map(
      ({ session: past, people, emails, hostMediaId }) => ({
        meetingId: past.meeting.code,
        title: past.meeting.title,
        hostName: past.hostName,
        hostedByYou: past.meeting.hostId === reader.id,
        start: iso(past.session.startedAt),
        end: iso(past.session.endedAt ?? past.session.startedAt),
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
      }),
    ),
    notes: notes.map((row) => ({
      meetingId: row.code,
      title: row.title,
      hostName: row.hostName,
      start: iso(row.session.startedAt),
      end: iso(row.session.endedAt ?? row.notes.madeAt),
      savedByYou: row.notes.savedBy === reader.id,
      shared: row.notes.shared,
      madeWith: row.notes.engine,
      provider: row.notes.provider,
      madeAt: iso(row.notes.madeAt),
      savedAt: iso(row.notes.savedAt),
      notes: row.notes.notes,
      transcript: row.notes.transcript,
    })),
  };
}
