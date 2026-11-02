import { sql } from "drizzle-orm";
import {
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

import type { MediaProviderId, SessionLimits } from "@/lib/media/types";
import type { SessionPolicy } from "@/lib/meetings/policy";
import type { MeetingSettings } from "@/lib/meetings/settings";

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
    passcode: text("passcode"),
    settings: jsonb("settings").$type<MeetingSettings>().notNull(),
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
    /** Bumped on every change to the session's shared state; clients ignore older ones. */
    rev: integer("rev").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("meeting_session_one_open")
      .on(table.meetingId)
      .where(sql`${table.status} = 'open'`),
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
    role: memberRole("role").notNull(),
    admittedAt: timestamp("admitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.mediaUserId] })],
);
