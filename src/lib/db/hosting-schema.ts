import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { RequestStatus } from "@/lib/hosting/rules";

import { user } from "./auth-schema";

/**
 * Addresses an admin approved in Settings → Admin to host full meetings, before or after their
 * owner signs up. The operator's settings (ADMIN_EMAILS, HOST_ALLOWLIST) count as well,
 * read from the settings themselves. An address counts once an account has verified it.
 */
export const hostAllowlist = pgTable("host_allowlist", {
  /** Lowercased. */
  email: text("email").primaryKey(),
  addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Invitation emails to approved addresses, whether an admin added them or the operator's
 * settings did. FaceOn emails one only when an admin chooses to (lib/hosting/invites.ts):
 * the latest one's time and sender, and how many there have been, are kept for its limits.
 * Taking an address off the list deletes its row; the daily sweep deletes the rows of
 * addresses that are on neither the list nor the settings any more.
 */
export const hostInvitation = pgTable("host_invitation", {
  /** Lowercased. */
  email: text("email").primaryKey(),
  /** When an admin last emailed this address an invitation. */
  invitedAt: timestamp("invited_at", { withTimezone: true }).notNull(),
  invitedBy: text("invited_by").references(() => user.id, {
    onDelete: "set null",
  }),
  /** How many invitation emails this address has had. */
  inviteCount: integer("invite_count").notNull().default(1),
});

/**
 * Someone asking the admins to host full meetings, and the answer. One open request
 * each; answered ones are deleted 90 days after (retention.ts), and with the account.
 */
export const hostingRequest = pgTable(
  "hosting_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note"),
    status: text("status").$type<RequestStatus>().notNull().default("pending"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** When they saw that it was approved (a note on Home), so it shows once. */
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("hosting_request_user").on(table.userId),
    uniqueIndex("hosting_request_one_open")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);
