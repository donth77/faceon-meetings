/**
 * What the schedule form sends, and what edits and deletes say about a series. Safe to
 * import in the browser.
 */
import { z } from "zod";

import { Recurrence } from "./recurrence";

/** Invite up to this many people by email. */
export const MAX_INVITEES = 50;

export const ScheduleInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  /** Local wall-clock start, "YYYY-MM-DDTHH:mm", in `timeZone`. */
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  timeZone: z.string().min(1).max(64),
  durationMin: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  recurrence: Recurrence.nullable(),
  /** Ask for a passcode (it's in the link, so invitees don't type it). */
  passcode: z.boolean(),
  waitingRoom: z.boolean(),
  allowGuests: z.boolean(),
  joinBeforeHost: z.boolean(),
  muteOnEntry: z.boolean(),
  invitees: z
    .array(z.email().transform((email) => email.toLowerCase()))
    .max(MAX_INVITEES),
});
export type ScheduleInput = z.input<typeof ScheduleInput>;
export type ScheduleValues = z.output<typeof ScheduleInput>;

/** Which meetings of a series an edit or delete applies to. */
export const SeriesScope = z.enum(["this", "following", "all"]);
export type SeriesScope = z.infer<typeof SeriesScope>;

/** An occurrence, by its planned start (ISO 8601), for "this" and "following". */
export const OccurrenceRef = z.iso.datetime({ offset: true });

export type ScheduleResult =
  | { ok: true; code: string; passcode: string | null }
  | { ok: false; reason: "dailyLimit" | "invalid" | "notFound" };
