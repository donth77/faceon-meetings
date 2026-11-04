import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * The emails FaceOn sent each day (UTC), for Settings → Admin's usage meter: counts
 * only, nothing about who they went to. With each send, the counts Resend reported in
 * its response headers: its daily count is for the UTC day, and its monthly count is
 * for its billing month and includes anything else sent from the same Resend account.
 * Kept two months (retention.ts).
 */
export const emailDay = pgTable("email_day", {
  /** The UTC day, as YYYY-MM-DD. */
  day: date("day", { mode: "string" }).primaryKey(),
  sent: integer("sent").notNull().default(0),
  resendDaily: integer("resend_daily"),
  resendMonthly: integer("resend_monthly"),
  /** When Resend last reported them. */
  resendAt: timestamp("resend_at", { withTimezone: true }),
  /**
   * How: from Resend's list of the account's emails (lib/usage/resend.ts), or from the
   * headers of its answer to an email FaceOn sent.
   */
  resendVia: text("resend_via").$type<"list" | "headers">(),
});

/**
 * The latest reading from a service the usage meter asks for its own figures (Neon's
 * compute hours): what it said and when, so Settings → Admin shows how fresh it is and
 * asks at most every five minutes (lib/usage). Counts only.
 */
export const usageReading = pgTable("usage_reading", {
  /** The service: "neon". */
  source: text("source").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull(),
});

/**
 * Usage warnings already emailed to the admins: one per meter, period and threshold,
 * so each goes once (lib/usage/alerts.ts). Kept two months.
 */
export const usageAlert = pgTable(
  "usage_alert",
  {
    /** A meter (lib/usage/meters.ts, MeterId). */
    meter: text("meter").notNull(),
    /** What the meter counts over: a UTC month ("2026-11"), or Neon's billing period's start. */
    period: text("period").notNull(),
    /** A percentage of the allowance (80 or 100). */
    threshold: integer("threshold").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.meter, table.period, table.threshold] }),
  ],
);
