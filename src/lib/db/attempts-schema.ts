import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Fixed-window counters for failed attempts (wrong passcodes, unknown meeting IDs).
 * Keys never hold a raw IP address, only a keyed hash of it.
 */
export const attemptCounter = pgTable("attempt_counter", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
