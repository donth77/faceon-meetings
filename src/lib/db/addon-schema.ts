import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

/**
 * Someone's own copy of the Google Workspace add-on: an Apps Script project FaceOn made
 * in their Google account (Settings → Calendar), one per person. FaceOn accepts the
 * add-on's requests only from that person's Google account, and keeps the project's code
 * current. Deleted when they remove it, and with the account.
 */
export const googleAddon = pgTable("google_addon", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** The Apps Script project in their Google account. */
  scriptId: text("script_id").notNull(),
  /** That Google account's ID (its `sub`): the only one whose requests are accepted. */
  googleSub: text("google_sub").notNull(),
  /**
   * The project's OAuth client: the `aud` of the identity tokens its add-on sends. Known
   * from the first request, which carries the connect token.
   */
  clientId: text("client_id").unique(),
  /** A keyed hash of the one-time token the add-on connects with; null once it has. */
  connectTokenHash: text("connect_token_hash").unique(),
  /** The build last written to the project. */
  version: text("version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** When its code was last written. */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  /** When FaceOn last tried to update it in the background, so it doesn't keep trying. */
  updateTriedAt: timestamp("update_tried_at", { withTimezone: true }),
  /**
   * When an update failed because Google no longer lets FaceOn write to the project:
   * Settings offers to update it, which asks Google again.
   */
  updateRefusedAt: timestamp("update_refused_at", { withTimezone: true }),
});
