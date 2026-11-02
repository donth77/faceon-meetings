import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { GoogleEventIds } from "@/lib/google-calendar/shared";
import type {
  MediaProviderId,
  NotesState,
  SessionLimits,
} from "@/lib/media/types";
import type { SessionPolicy } from "@/lib/meetings/policy";
import type { MeetingSettings } from "@/lib/meetings/settings";
import type { EngineId, MeetingNotes } from "@/lib/notes/notes";
import type { ProviderId } from "@/lib/notes/providers";

import { user } from "./auth-schema";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const meetingType = pgEnum("meeting_type", [
  "instant",
  "scheduled",
  "personal",
]);
export const meetingStatus = pgEnum("meeting_status", [
  "active",
  "ended",
  "cancelled",
]);
export const sessionStatus = pgEnum("session_status", ["open", "ended"]);
export const memberRole = pgEnum("member_role", [
  "host",
  "cohost",
  "participant",
  "guest",
]);

/**
 * A meeting definition: instant, scheduled or a personal room. It has no media call of
 * its own; every session (each time it runs) gets a fresh one.
 */
export const meeting = pgTable(
  "meeting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 10 random digits, never starting with 0. */
    code: text("code").notNull().unique(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: meetingType("type").notNull(),
    status: meetingStatus("status").notNull().default("active"),
    /** Null shows the default, "{host}'s meeting", in each viewer's language. */
    title: text("title"),
    description: text("description"),
    passcode: text("passcode"),
    settings: jsonb("settings").$type<MeetingSettings>().notNull(),
    /** Scheduled meetings: when it (or a series' first meeting) starts, and for how long. */
    startsAt: timestamp("starts_at", { withTimezone: true }),
    durationMin: integer("duration_min"),
    /** The IANA time zone it was scheduled in; a series keeps its local time in it. */
    timeZone: text("time_zone"),
    /** Never used: Calendar sync keeps googleEvents instead. A later migration drops it. */
    googleEventId: text("google_event_id"),
    /**
     * Calendar sync: the meeting's events in the host's Google Calendar, by the key each
     * was made for (a series rule's ID, or "single"). Null when it isn't synced.
     */
    googleEvents: jsonb("google_events").$type<GoogleEventIds>(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("meeting_host_idx").on(table.hostId),
    uniqueIndex("meeting_one_personal_room")
      .on(table.hostId)
      .where(sql`${table.type} = 'personal'`),
  ],
);

/** One run of a meeting. Its id is also the media call (or room) id. */
export const meetingSession = pgTable(
  "meeting_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    /** The media provider this session runs on. Sessions never move between providers. */
    provider: text("provider").$type<MediaProviderId>().notNull(),
    status: sessionStatus("status").notNull().default("open"),
    limits: jsonb("limits").$type<SessionLimits>().notNull(),
    /** Raised hands: media user ID → when it went up (ISO 8601). */
    hands: jsonb("hands")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** What hosts changed during the session (lock, chat, …); the rest follows the meeting's settings. */
    policy: jsonb("policy")
      .$type<Partial<SessionPolicy>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Shown large for everyone: a media user ID. */
    spotlight: text("spotlight"),
    /** AI notes, while a host has them on. */
    notes: jsonb("notes").$type<NotesState>(),
    /**
     * The meeting's host allows AI notes (Settings → AI notes). Taken as the session
     * opens, and kept in step when they change it (allowNotesInMeetings).
     */
    notesAllowed: boolean("notes_allowed").notNull().default(false),
    /** Bumped on every change to the session's shared state; clients ignore older ones. */
    rev: integer("rev").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** For a scheduled meeting: the occurrence this session ran (its planned start). */
    occurrenceStart: timestamp("occurrence_start", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("meeting_session_one_open")
      .on(table.meetingId)
      .where(sql`${table.status} = 'open'`),
    // A meeting's sessions by start: demo limits, the sweep, deletes.
    index("meeting_session_meeting").on(table.meetingId, table.startedAt),
  ],
);

/**
 * The admission ledger: everyone admitted to a session, with their role. It's the source
 * of truth for roles, removals and token refreshes.
 */
export const meetingMember = pgTable(
  "meeting_member",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => meetingSession.id, { onDelete: "cascade" }),
    /** The person's media identity: "u_<userId>" when signed in, "g_<guestId>" for guests. */
    mediaUserId: text("media_user_id").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    /** Their avatar when admitted, for Previous: guests have no account to look it up in. */
    image: text("image"),
    role: memberRole("role").notNull(),
    admittedAt: timestamp("admitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.mediaUserId] }),
    // Someone's sessions (Previous), and clearing them when their account goes.
    index("meeting_member_user").on(table.userId),
  ],
);

export const admissionStatus = pgEnum("admission_status", [
  "pending",
  "admitted",
  "denied",
  "cancelled",
  "expired",
]);

/**
 * Someone asking to join through the waiting room. Hosts admit or deny; the person's
 * browser polls until then. A request not polled for a while expires when it's next read.
 */
export const admissionRequest = pgTable(
  "admission_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => meetingSession.id, { onDelete: "cascade" }),
    /** Who is asking: their media identity, as in meeting_member. */
    mediaUserId: text("media_user_id").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    image: text("image"),
    status: admissionStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    /** The last poll; hosts see only requests whose browser is still asking. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    index("admission_request_session").on(table.sessionId, table.status),
    index("admission_request_user").on(table.userId),
    // One open request per person per session.
    uniqueIndex("admission_request_one_pending")
      .on(table.sessionId, table.mediaUserId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/** People invited to a scheduled meeting, by email. Deleted with the meeting. */
export const meetingInvitee = pgTable(
  "meeting_invitee",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    /** Lowercased. */
    email: text("email").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.email] }),
    index("meeting_invitee_email").on(table.email),
  ],
);

/**
 * How a recurring meeting repeats: an RFC 5545 rule (without DTSTART), expanded in the
 * meeting's time zone. Usually one row; "this and following" ends one and starts
 * another, so the ID and link never change.
 */
export const meetingRule = pgTable(
  "meeting_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    rrule: text("rrule").notNull(),
    /** The first occurrence this rule covers. */
    firstStart: timestamp("first_start", { withTimezone: true }).notNull(),
    /** Null while the series runs on. */
    lastStart: timestamp("last_start", { withTimezone: true }),
    durationMin: integer("duration_min").notNull(),
    timeZone: text("time_zone").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("meeting_rule_meeting").on(table.meetingId)],
);

/** One occurrence of a series moved, retitled or cancelled ("this meeting" edits). */
export const meetingException = pgTable(
  "meeting_exception",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    /** The occurrence's planned start, which identifies it. */
    originalStart: timestamp("original_start", {
      withTimezone: true,
    }).notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    durationMin: integer("duration_min"),
    title: text("title"),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.originalStart] })],
);

/**
 * Attendance: one row per connection to a session, from the media provider's webhooks.
 * Previous shows who came, when they joined and when they left.
 */
export const participantSession = pgTable(
  "participant_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => meetingSession.id, { onDelete: "cascade" }),
    /** The provider's ID for this connection; a rejoin is a new one. */
    connectionId: text("connection_id").notNull().unique(),
    mediaUserId: text("media_user_id").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    image: text("image"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    index("participant_session_session").on(table.sessionId),
    index("participant_session_user").on(table.userId),
  ],
);

/**
 * AI notes a host or co-host saved to a session, only when they chose to. Shared notes
 * show under Previous for the session's signed-in attendees. They go with the session,
 * with the account that saved them, or after 90 days with the session's attendance.
 */
export const meetingNotes = pgTable(
  "meeting_notes",
  {
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => meetingSession.id, { onDelete: "cascade" }),
    savedBy: text("saved_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notes: jsonb("notes").$type<MeetingNotes>().notNull(),
    /** The transcript as text ("Ana (10:02): …"), when it fit. */
    transcript: text("transcript"),
    engine: text("engine").$type<EngineId>().notNull(),
    provider: text("provider").$type<ProviderId>(),
    /** When the notes were made, which can be before they were saved. */
    madeAt: timestamp("made_at", { withTimezone: true }).notNull(),
    shared: boolean("shared").notNull().default(false),
    savedAt: timestamp("saved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("meeting_notes_saved_by").on(table.savedBy)],
);

/** Webhook deliveries already handled, so a retry or replay changes nothing. */
export const webhookEvent = pgTable("webhook_event", {
  id: text("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
