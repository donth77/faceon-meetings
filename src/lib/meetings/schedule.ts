/**
 * What the schedule form sends, and what edits and deletes say about a series. Safe to
 * import in the browser.
 */
import { z } from "zod";

import type { CalendarOutcome } from "@/lib/google-calendar/shared";

import { latestSeriesEnd, Recurrence } from "./recurrence";

/** Invite up to this many people by email. */
export const MAX_INVITEES = 50;
/** Name up to this many co-hosts ahead of time. */
export const MAX_COHOSTS = 10;

/**
 * Named co-hosts: they join as co-hosts when signed in with one of these addresses
 * (verified), and are invited along with everyone else. Lowercased, each once.
 */
export const CohostList = z
  .array(z.email().transform((email) => email.toLowerCase()))
  .max(MAX_COHOSTS)
  .refine((emails) => new Set(emails).size === emails.length);

/** Named co-hosts a host may save: a valid list without their own address (they host). */
export function cohostsAllowed(
  cohosts: readonly string[],
  hostEmail: string,
): boolean {
  const own = hostEmail.toLowerCase();
  return (
    CohostList.safeParse(cohosts).success &&
    cohosts.every((email) => email.toLowerCase() !== own)
  );
}
/** The longest title and description a meeting can have, in characters. */
export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 2000;

export const ScheduleInput = z
  .object({
    title: z.string().trim().min(1).max(MAX_TITLE),
    description: z.string().trim().max(MAX_DESCRIPTION).default(""),
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
    /** AI notes start by themselves when a host or co-host joins. */
    autoNotes: z.boolean().default(false),
    /** AI notes are saved and shared with the participants as soon as they're made. */
    shareNotes: z.boolean().default(false),
    invitees: z
      .array(z.email().transform((email) => email.toLowerCase()))
      .max(MAX_INVITEES),
    cohosts: CohostList.default([]),
    /** Add it to the host's Google Calendar, so Google invites people (Calendar sync). */
    googleCalendar: z.boolean().default(false),
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
  | {
      ok: true;
      code: string;
      passcode: string | null;
      /** How Google Calendar took it, for a synced meeting. */
      calendar?: CalendarOutcome;
    }
  | { ok: false; reason: "dailyLimit" | "invalid" | "notFound" };

export type DeleteResult = { ok: boolean; calendar?: CalendarOutcome };
