import "server-only";

import {
  and,
  asc,
  count,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  not,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import {
  meeting,
  meetingInvitee,
  meetingMember,
  meetingSession,
  participantSession,
  user,
} from "@/lib/db/schema";
import { aiNotesEnabled } from "@/lib/env";
import { hostingPlanOf } from "@/lib/hosting/access";
import type {
  MediaProviderId,
  MeetingRole,
  SessionLimits,
} from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

import type { MeetingLimits } from "./api";
import { MEETING_CODE_PATTERN } from "./codes";
import { generateMeetingCode, generatePasscode } from "./generate";
import { limitsFor } from "./hosting";
import { daysBefore, KEEP_DAYS } from "./retention";
import {
  closedReason,
  notesStartAutomatically,
  passcodeNeeded,
  resolveRole,
  type ClosedReason,
} from "./rules";
import { DEFAULT_SETTINGS, MeetingSettings } from "./settings";

export type Meeting = Omit<typeof meeting.$inferSelect, "settings"> & {
  settings: MeetingSettings;
};
export type MeetingSession = typeof meetingSession.$inferSelect;
export type MeetingMember = typeof meetingMember.$inferSelect;
export type MeetingHost = Pick<
  typeof user.$inferSelect,
  | "id"
  | "name"
  | "email"
  | "emailVerified"
  | "image"
  | "avatarSeed"
  | "avatarSource"
  | "aiNotes"
>;

/** Unused instant meetings are deleted this long after they were last used. */
const KEEP_UNUSED_MS = 30 * 24 * 60 * 60 * 1000;
const keepUntil = () => new Date(Date.now() + KEEP_UNUSED_MS);

/** Settings are checked on every read; settings added later fall back to their defaults. */
export function readMeeting(row: typeof meeting.$inferSelect): Meeting {
  return {
    ...row,
    settings: MeetingSettings.parse({
      ...DEFAULT_SETTINGS[row.type],
      ...row.settings,
    }),
  };
}

/**
 * Creates an instant meeting (or one for later) with a fresh meeting ID and passcode.
 * The Workspace add-on can give it a title, and mark it as Google Calendar's.
 */
export async function insertInstantMeeting(
  hostId: string,
  extra: {
    title?: string | null;
    origin?: Meeting["origin"];
    googleAddonEvent?: Meeting["googleAddonEvent"];
  } = {},
): Promise<Meeting> {
  // Meeting IDs are random, so a collision is rare; try a new one on each.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db()
      .insert(meeting)
      .values({
        code: generateMeetingCode(),
        hostId,
        type: "instant",
        title: extra.title ?? null,
        passcode: generatePasscode(),
        settings: DEFAULT_SETTINGS.instant,
        expiresAt: keepUntil(),
        origin: extra.origin ?? "faceon",
        googleAddonEvent: extra.googleAddonEvent ?? null,
      })
      .onConflictDoNothing({ target: meeting.code })
      .returning();
    if (row) return readMeeting(row);
  }
  throw new Error("Could not find a free meeting ID.");
}

/** The user's personal room (Personal Meeting ID), if they have opened it before. */
export async function findPersonalRoom(
  hostId: string,
): Promise<Meeting | null> {
  const [row] = await db()
    .select()
    .from(meeting)
    .where(and(eq(meeting.hostId, hostId), eq(meeting.type, "personal")))
    .limit(1);
  return row ? readMeeting(row) : null;
}

/**
 * The user's personal room, created on first use. It never expires. A unique index
 * allows one per user, so a concurrent first visit gets the same room.
 */
export async function getOrCreatePersonalRoom(
  hostId: string,
): Promise<Meeting> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await findPersonalRoom(hostId);
    if (existing) return existing;
    const [row] = await db()
      .insert(meeting)
      .values({
        code: generateMeetingCode(),
        hostId,
        type: "personal",
        passcode: generatePasscode(),
        settings: DEFAULT_SETTINGS.personal,
      })
      .onConflictDoNothing()
      .returning();
    if (row) return readMeeting(row);
  }
  throw new Error("Could not create a personal room.");
}

/** A new Personal Meeting ID and passcode: the old link stops working at once. */
export async function rotatePersonalRoomCode(hostId: string): Promise<Meeting> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db()
        .update(meeting)
        .set({ code: generateMeetingCode(), passcode: generatePasscode() })
        .where(and(eq(meeting.hostId, hostId), eq(meeting.type, "personal")))
        .returning();
      if (!row) throw new Error("This account has no personal room.");
      return readMeeting(row);
    } catch (error) {
      // Another meeting already has that ID (rare): try another.
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not find a free meeting ID.");
}

/** Changes some of a meeting's settings, checked against the full schema. */
export async function updateMeetingSettings(
  meetingId: string,
  hostId: string,
  changes: Partial<MeetingSettings>,
): Promise<void> {
  const [row] = await db()
    .select()
    .from(meeting)
    .where(and(eq(meeting.id, meetingId), eq(meeting.hostId, hostId)))
    .limit(1);
  if (!row) throw new Error("Meeting not found.");
  const settings = MeetingSettings.parse({
    ...readMeeting(row).settings,
    ...changes,
  });
  await db().update(meeting).set({ settings }).where(eq(meeting.id, meetingId));
}

/** A host sets their meeting's passcode. */
export async function setMeetingPasscode(
  meetingId: string,
  hostId: string,
  passcode: string,
): Promise<void> {
  await db()
    .update(meeting)
    .set({ passcode })
    .where(and(eq(meeting.id, meetingId), eq(meeting.hostId, hostId)));
}

/** Postgres's unique_violation, possibly wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value
      ? value.code
      : undefined;
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? error.cause
      : undefined;
  return code(error) === "23505" || code(cause) === "23505";
}

/** A meeting and its host, by meeting ID. */
export async function findMeetingByCode(
  code: string,
): Promise<{ meeting: Meeting; host: MeetingHost } | null> {
  const [row] = await db()
    .select({
      meeting,
      host: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        avatarSeed: user.avatarSeed,
        avatarSource: user.avatarSource,
        aiNotes: user.aiNotes,
      },
    })
    .from(meeting)
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(eq(meeting.code, code))
    .limit(1);
  return row ? { meeting: readMeeting(row.meeting), host: row.host } : null;
}

/**
 * What the meeting page shows before joining: the title and host, and why the link no
 * longer works, if it doesn't. Null for an unknown meeting ID.
 */
export async function getMeetingSummary(
  code: string,
  /** Who's opening the page: their account, or this browser's guest identity. */
  viewer: {
    userId: string | null;
    mediaUserId: string;
    /** Their address once verified (lowercased), which named co-hosts are matched on. */
    verifiedEmail: string | null;
  } | null = null,
): Promise<{
  code: string;
  title: string | null;
  hostId: string;
  hostName: string;
  closed: ClosedReason | null;
  allowGuests: boolean;
  waitingRoom: boolean;
  /** AI notes are on in the session running now. */
  notesOn: boolean;
  /** AI notes start by themselves once a host or co-host is in. */
  notesAuto: boolean;
  /** AI notes are shared with the participants as soon as they're made. */
  notesShared: boolean;
  limits: MeetingLimits;
  /** They'll need the passcode to join (never the passcode itself). */
  needsPasscode: boolean;
  /** They'll join as a co-host: named by the meeting, or made one in this session. */
  joinsAsCohost: boolean;
} | null> {
  if (!MEETING_CODE_PATTERN.test(code)) return null;
  const found = await findMeetingByCode(code);
  if (!found) return null;
  const open = await findOpenSession(found.meeting.id);
  // As joining decides it: hosts, co-hosts (named by the meeting, or made one in the
  // session running now) and people already let into it don't need the passcode.
  const isOwner = viewer?.userId === found.host.id;
  const member =
    open && viewer ? await findMember(open.id, viewer.mediaUserId) : null;
  const role = resolveRole({
    isOwner,
    isGuest: viewer?.userId == null,
    memberRole: member?.role,
    namedCohost:
      !isOwner &&
      !member &&
      viewer?.verifiedEmail != null &&
      (await isNamedCohost(found.meeting.id, viewer.verifiedEmail)),
  });
  const needsPasscode =
    passcodeNeeded({
      role,
      passcode: found.meeting.passcode,
      isMember: member !== null,
    }) !== null;
  // As the session running now has them; before one opens, as its host's plan would.
  const limits = open?.limits ?? limitsFor(await hostingPlanOf(found.host));
  return {
    code,
    limits: {
      demo: limits.demo === true,
      people: limits.maxParticipants,
      minutes: limits.maxDurationSeconds
        ? Math.round(limits.maxDurationSeconds / 60)
        : null,
      demoPerDay: serverEnv().DEMO_MEETINGS_PER_DAY,
    },
    needsPasscode,
    joinsAsCohost: role === "cohost",
    title: found.meeting.title,
    notesShared: found.meeting.settings.shareNotes,
    hostId: found.host.id,
    hostName: found.host.name,
    closed: closedReason(found.meeting, new Date()),
    allowGuests: found.meeting.settings.allowGuests,
    waitingRoom: found.meeting.settings.waitingRoom,
    notesOn: open?.notes != null,
    // As the session has it once one is open; before that, as it would open.
    notesAuto:
      aiNotesEnabled &&
      notesStartAutomatically({
        autoNotes: found.meeting.settings.autoNotes,
        allowed: open ? open.notesAllowed : found.host.aiNotes,
        demo: open
          ? open.limits.demo === true
          : (await hostingPlanOf(found.host)) === "demo",
        stopped: open?.notesStopped ?? false,
      }),
  };
}

/**
 * Whether a meeting ID leads to a meeting that can be joined: "open", why its link
 * stopped working, or null when there's no such meeting. No more than its page shows.
 */
export async function meetingAvailability(
  code: string,
): Promise<"open" | ClosedReason | null> {
  if (!MEETING_CODE_PATTERN.test(code)) return null;
  const found = await findMeetingByCode(code);
  if (!found) return null;
  return closedReason(found.meeting, new Date()) ?? "open";
}

/** Sessions opened in a host's meetings since a moment, for the demo daily cap. */
export async function countSessionsSince(
  hostId: string,
  since: Date,
): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(meetingSession)
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .where(
      and(eq(meeting.hostId, hostId), gte(meetingSession.startedAt, since)),
    );
  return row?.count ?? 0;
}

/**
 * Sessions open now, across all meetings. Sessions open for more than 12 hours are left
 * out: they're leftovers whose call ended unnoticed, which the next join closes.
 */
export async function countOpenSessions(now: Date): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(meetingSession)
    .where(
      and(
        eq(meetingSession.status, "open"),
        gte(meetingSession.startedAt, new Date(now.getTime() - 12 * 3_600_000)),
      ),
    );
  return row?.count ?? 0;
}

/** Meetings a host created since a moment, for the daily creation cap. */
export async function countMeetingsCreatedSince(
  hostId: string,
  since: Date,
): Promise<number> {
  const [row] = await db()
    .select({ count: count() })
    .from(meeting)
    .where(and(eq(meeting.hostId, hostId), gte(meeting.createdAt, since)));
  return row?.count ?? 0;
}

/** Marks a meeting ended, so its link stops working. */
export async function endMeeting(meetingId: string): Promise<void> {
  await db()
    .update(meeting)
    .set({ status: "ended" })
    .where(and(eq(meeting.id, meetingId), eq(meeting.status, "active")));
}

/** Whether a meeting names this (verified, lowercased) address as a co-host. */
export async function isNamedCohost(
  meetingId: string,
  email: string,
): Promise<boolean> {
  const [row] = await db()
    .select({ email: meetingInvitee.email })
    .from(meetingInvitee)
    .where(
      and(
        eq(meetingInvitee.meetingId, meetingId),
        eq(meetingInvitee.email, email),
        eq(meetingInvitee.cohost, true),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** A meeting's named co-hosts, in the order they were added. */
export async function namedCohostsOf(meetingId: string): Promise<string[]> {
  const rows = await db()
    .select({ email: meetingInvitee.email })
    .from(meetingInvitee)
    .where(
      and(
        eq(meetingInvitee.meetingId, meetingId),
        eq(meetingInvitee.cohost, true),
      ),
    )
    .orderBy(asc(meetingInvitee.addedAt));
  return rows.map((row) => row.email);
}

/**
 * Names a meeting's co-hosts (the personal room's page): replaces the list. Anyone
 * already in a running session keeps the role they have there; the list applies from
 * their next session, or to anyone joining now for the first time.
 */
export async function setNamedCohosts(
  meetingId: string,
  emails: readonly string[],
): Promise<void> {
  await db().transaction(async (tx) => {
    await tx
      .delete(meetingInvitee)
      .where(
        and(
          eq(meetingInvitee.meetingId, meetingId),
          eq(meetingInvitee.cohost, true),
        ),
      );
    if (emails.length > 0) {
      await tx
        .insert(meetingInvitee)
        .values(emails.map((email) => ({ meetingId, email, cohost: true })))
        .onConflictDoUpdate({
          target: [meetingInvitee.meetingId, meetingInvitee.email],
          set: { cohost: true },
        });
    }
  });
}

export async function findOpenSession(
  meetingId: string,
): Promise<MeetingSession | null> {
  const [row] = await db()
    .select()
    .from(meetingSession)
    .where(
      and(
        eq(meetingSession.meetingId, meetingId),
        eq(meetingSession.status, "open"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Opens a session for a meeting, or returns the one a concurrent join just opened
 * (there's at most one open session per meeting). Also extends an instant meeting's life.
 */
export async function openSession(input: {
  meeting: Meeting;
  provider: MediaProviderId;
  limits: SessionLimits;
}): Promise<MeetingSession> {
  const [created] = await db()
    .insert(meetingSession)
    .values({
      meetingId: input.meeting.id,
      provider: input.provider,
      limits: input.limits,
      // Whether the host allows AI notes, read as the row goes in, so a change to the
      // setting either lands before it or finds this session open (allowNotesInMeetings).
      notesAllowed: sql`(select ${user.aiNotes} from ${user} where ${user.id} = ${input.meeting.hostId})`,
      // This server's clock, the same one that later works out the time left.
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (input.meeting.type === "instant") {
    await db()
      .update(meeting)
      .set({ expiresAt: keepUntil() })
      .where(eq(meeting.id, input.meeting.id));
  }
  if (created) return created;
  const existing = await findOpenSession(input.meeting.id);
  if (!existing) throw new Error("Could not open a meeting session.");
  return existing;
}

/** Closes an open session as of `endedAt`: now, unless it ended earlier (sessionEndedAt). */
export async function closeSession(
  sessionId: string,
  endedAt = new Date(),
): Promise<void> {
  await db()
    .update(meetingSession)
    .set({ status: "ended", endedAt })
    .where(
      and(eq(meetingSession.id, sessionId), eq(meetingSession.status, "open")),
    );
}

/** `lastSeenAt` moved on to `at`, never back: events can arrive out of order. */
export const seenAt = (at: Date) => {
  const when = sql`${at.toISOString()}::timestamptz`;
  return sql`greatest(coalesce(${meetingSession.lastSeenAt}, ${when}), ${when})`;
};

/** Someone was in the open session at `at` (see meetingSession.lastSeenAt). */
export async function markSessionSeen(
  sessionId: string,
  at: Date,
): Promise<void> {
  await db()
    .update(meetingSession)
    .set({ lastSeenAt: seenAt(at) })
    .where(
      and(eq(meetingSession.id, sessionId), eq(meetingSession.status, "open")),
    );
}

export async function findMember(
  sessionId: string,
  mediaUserId: string,
): Promise<MeetingMember | null> {
  const [row] = await db()
    .select()
    .from(meetingMember)
    .where(
      and(
        eq(meetingMember.sessionId, sessionId),
        eq(meetingMember.mediaUserId, mediaUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Records an admission. A rejoin updates the name and role in place. */
export async function upsertMember(input: {
  sessionId: string;
  mediaUserId: string;
  userId: string | null;
  displayName: string;
  image: string | null;
  role: MeetingRole;
}): Promise<void> {
  await db()
    .insert(meetingMember)
    .values(input)
    .onConflictDoUpdate({
      target: [meetingMember.sessionId, meetingMember.mediaUserId],
      set: {
        displayName: input.displayName,
        image: input.image,
        role: input.role,
      },
    });
}

/** Media user IDs of the session's hosts and co-hosts who haven't been removed. */
export async function hostMemberIds(sessionId: string): Promise<string[]> {
  const rows = await db()
    .select({ id: meetingMember.mediaUserId })
    .from(meetingMember)
    .where(
      and(
        eq(meetingMember.sessionId, sessionId),
        inArray(meetingMember.role, ["host", "cohost"]),
        isNull(meetingMember.bannedAt),
      ),
    );
  return rows.map((row) => row.id);
}

/** Everyone admitted to a session who hasn't been removed. */
export async function sessionMembers(
  sessionId: string,
): Promise<MeetingMember[]> {
  return db()
    .select()
    .from(meetingMember)
    .where(
      and(
        eq(meetingMember.sessionId, sessionId),
        isNull(meetingMember.bannedAt),
      ),
    );
}

export async function setMemberRole(
  sessionId: string,
  mediaUserId: string,
  role: MeetingRole,
): Promise<void> {
  await db()
    .update(meetingMember)
    .set({ role })
    .where(
      and(
        eq(meetingMember.sessionId, sessionId),
        eq(meetingMember.mediaUserId, mediaUserId),
      ),
    );
}

/** Removes someone from a session for good: they can't rejoin it. */
export async function banMember(
  sessionId: string,
  mediaUserId: string,
): Promise<void> {
  await db()
    .update(meetingMember)
    .set({ bannedAt: new Date() })
    .where(
      and(
        eq(meetingMember.sessionId, sessionId),
        eq(meetingMember.mediaUserId, mediaUserId),
      ),
    );
}

/** The open sessions of the meetings someone hosts, with their meetings. */
export async function openSessionsHostedBy(
  hostId: string,
): Promise<Array<{ meeting: Meeting; session: MeetingSession }>> {
  const rows = await db()
    .select({ meeting, session: meetingSession })
    .from(meetingSession)
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .where(and(eq(meeting.hostId, hostId), eq(meetingSession.status, "open")));
  return rows.map((row) => ({
    meeting: readMeeting(row.meeting),
    session: row.session,
  }));
}

/** Open sessions started before a moment, with their meetings: candidates for closing. */
export async function openSessionsStartedBefore(
  before: Date,
): Promise<Meeting[]> {
  const rows = await db()
    .select({ meeting })
    .from(meetingSession)
    .innerJoin(meeting, eq(meeting.id, meetingSession.meetingId))
    .where(
      and(
        eq(meetingSession.status, "open"),
        lt(meetingSession.startedAt, before),
      ),
    );
  return rows.map((row) => readMeeting(row.meeting));
}

/**
 * Deletes meetings past their expiry, with their sessions: unused instant meetings, and
 * scheduled ones a month after their last meeting. The link stops working at expiry
 * (closedReason); the meeting itself stays until its last session leaves Previous, so
 * history and saved AI notes last as long as promised.
 */
export async function deleteExpiredMeetings(now: Date): Promise<number> {
  const recentSession = db()
    .select({ one: meetingSession.id })
    .from(meetingSession)
    .where(
      and(
        eq(meetingSession.meetingId, meeting.id),
        gte(meetingSession.startedAt, daysBefore(now, KEEP_DAYS.history)),
      ),
    );
  const deleted = await db()
    .delete(meeting)
    .where(and(lt(meeting.expiresAt, now), not(exists(recentSession))))
    .returning({ id: meeting.id });
  return deleted.length;
}

/**
 * Deletes admission records of sessions that ended before a moment. Removals stay as
 * long as attendance does (until `removalsBefore`), so someone removed never counts as
 * having attended the session, and can't read its shared notes.
 */
export async function pruneEndedSessionMembers(
  before: Date,
  removalsBefore: Date,
): Promise<number> {
  const ended = db()
    .select({ id: meetingSession.id })
    .from(meetingSession)
    .where(
      and(
        eq(meetingSession.status, "ended"),
        lt(meetingSession.endedAt, before),
      ),
    );
  const deleted = await db()
    .delete(meetingMember)
    .where(
      and(
        inArray(meetingMember.sessionId, ended),
        or(
          isNull(meetingMember.bannedAt),
          lt(meetingMember.bannedAt, removalsBefore),
        ),
      ),
    )
    .returning({ sessionId: meetingMember.sessionId });
  return deleted.length;
}

/**
 * Someone with an account was in the session (admitted to it, or in its attendance) and
 * wasn't removed from it. Admission records go a week after a session; attendance and
 * removals stay as long as the session does.
 */
export function attendedBy(viewerId: string) {
  const removed = exists(
    db()
      .select({ one: meetingMember.sessionId })
      .from(meetingMember)
      .where(
        and(
          eq(meetingMember.sessionId, meetingSession.id),
          eq(meetingMember.userId, viewerId),
          isNotNull(meetingMember.bannedAt),
        ),
      ),
  );
  return and(
    or(
      exists(
        db()
          .select({ one: meetingMember.sessionId })
          .from(meetingMember)
          .where(
            and(
              eq(meetingMember.sessionId, meetingSession.id),
              eq(meetingMember.userId, viewerId),
            ),
          ),
      ),
      exists(
        db()
          .select({ one: participantSession.sessionId })
          .from(participantSession)
          .where(
            and(
              eq(participantSession.sessionId, meetingSession.id),
              eq(participantSession.userId, viewerId),
            ),
          ),
      ),
    ),
    not(removed),
  );
}
