import "server-only";

import { and, count, eq, gte, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { meeting, meetingMember, meetingSession, user } from "@/lib/db/schema";
import type {
  MediaProviderId,
  MeetingRole,
  SessionLimits,
} from "@/lib/media/types";

import { MEETING_CODE_PATTERN } from "./codes";
import { generateMeetingCode, generatePasscode } from "./generate";
import { isJoinable } from "./rules";
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
>;

/** Unused instant meetings are deleted this long after they were last used. */
const KEEP_UNUSED_MS = 30 * 24 * 60 * 60 * 1000;
const keepUntil = () => new Date(Date.now() + KEEP_UNUSED_MS);

/** Settings are checked on every read; settings added later fall back to their defaults. */
function readMeeting(row: typeof meeting.$inferSelect): Meeting {
  return {
    ...row,
    settings: MeetingSettings.parse({
      ...DEFAULT_SETTINGS[row.type],
      ...row.settings,
    }),
  };
}

/** Creates an instant meeting (or one for later) with a fresh meeting ID and passcode. */
export async function insertInstantMeeting(hostId: string): Promise<Meeting> {
  // Meeting IDs are random, so a collision is rare; try a new one on each.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db()
      .insert(meeting)
      .values({
        code: generateMeetingCode(),
        hostId,
        type: "instant",
        passcode: generatePasscode(),
        settings: DEFAULT_SETTINGS.instant,
        expiresAt: keepUntil(),
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

/** Postgres's unique_violation, possibly wrapped by Drizzle. */
function isUniqueViolation(error: unknown): boolean {
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
      },
    })
    .from(meeting)
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(eq(meeting.code, code))
    .limit(1);
  return row ? { meeting: readMeeting(row.meeting), host: row.host } : null;
}

/**
 * What the meeting page shows before joining: the title and host, and whether the link
 * still works. Null for an unknown meeting ID.
 */
export async function getMeetingSummary(code: string): Promise<{
  code: string;
  title: string | null;
  hostName: string;
  joinable: boolean;
  allowGuests: boolean;
} | null> {
  if (!MEETING_CODE_PATTERN.test(code)) return null;
  const found = await findMeetingByCode(code);
  if (!found) return null;
  return {
    code,
    title: found.meeting.title,
    hostName: found.host.name,
    joinable: isJoinable(found.meeting, new Date()),
    allowGuests: found.meeting.settings.allowGuests,
  };
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

export async function closeSession(sessionId: string): Promise<void> {
  await db()
    .update(meetingSession)
    .set({ status: "ended", endedAt: new Date() })
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
  role: MeetingRole;
}): Promise<void> {
  await db()
    .insert(meetingMember)
    .values(input)
    .onConflictDoUpdate({
      target: [meetingMember.sessionId, meetingMember.mediaUserId],
      set: { displayName: input.displayName, role: input.role },
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
