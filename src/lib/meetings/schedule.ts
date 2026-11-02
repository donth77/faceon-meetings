/**
 * What the schedule form sends, and what edits and deletes say about a series. Safe to
 * import in the browser.
 */
import { z } from "zod";

import { latestSeriesEnd, Recurrence } from "./recurrence";

/** Invite up to this many people by email. */
export const MAX_INVITEES = 50;

export const ScheduleInput = z
  .object({
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
  })
  // A series ends within a few years of its start, as the form's date picker allows.
  .refine(
    ({ start, recurrence }) =>
      recurrence?.end.kind !== "on" ||
      recurrence.end.date <= latestSeriesEnd(start),
    { path: ["recurrence", "end"] },
  );
export type ScheduleInput = z.input<typeof ScheduleInput>;
export type ScheduleValues = z.output<typeof ScheduleInput>;

/**
 * A meeting ID and passcode the schedule form previews before saving, signed by the
 * server (schedule-draft.ts) so a client can't choose its own.
 */
export const ScheduleDraft = z.object({
  code: z.string().max(64),
  passcode: z.string().max(64),
  token: z.string().max(256),
});
export type ScheduleDraft = z.infer<typeof ScheduleDraft>;

/** Which meetings of a series an edit or delete applies to. */
export const SeriesScope = z.enum(["this", "following", "all"]);
export type SeriesScope = z.infer<typeof SeriesScope>;

/** An occurrence, by its planned start (ISO 8601), for "this" and "following". */
export const OccurrenceRef = z.iso.datetime({ offset: true });

export type ScheduleResult =
  | { ok: true; code: string; passcode: string | null }
  | { ok: false; reason: "dailyLimit" | "invalid" | "notFound" };
