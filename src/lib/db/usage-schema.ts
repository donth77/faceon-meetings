import {
  date,
  integer,
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
