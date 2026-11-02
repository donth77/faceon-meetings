import { sql } from "drizzle-orm";
import {
  index,
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
