import "server-only";

import { aliasedTable, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  account,
  hostAllowlist,
  hostingRequest,
  meeting,
  meetingException,
  meetingInvitee,
  meetingRule,
  session,
  user,
} from "@/lib/db/schema";
import { hostingPlanOf } from "@/lib/hosting/access";
import { approvedBySettings, isAdmin } from "@/lib/meetings/hosting";
import type { MeetingSettings } from "@/lib/meetings/settings";

import {
  historyData,
  type NoteEntry,
  type PreviousEntry,
} from "./history-data";

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
  previous: PreviousEntry[];
  notes: NoteEntry[];
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
  const [
    [person],
    methods,
    sessions,
    hosted,
    [approval],
    requests,
    history,
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
    historyData(reader),
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
    previous: history.previous,
    notes: history.notes,
  };
}
