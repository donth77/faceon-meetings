import { z } from "@/lib/zod";

import { ScheduleInput, type ScheduleValues } from "./schedule";

/**
 * The options a host schedules with, kept on their account (`user.schedule_defaults`) so
 * their next meeting starts from them, after signing out or on another device too. Never
 * a meeting's own details: its title, description, time, time zone, recurrence, people
 * or passcode.
 */
type Remembered =
  | "durationMin"
  | "passcode"
  | "waitingRoom"
  | "allowGuests"
  | "joinBeforeHost"
  | "muteOnEntry"
  | "autoNotes"
  | "shareNotes"
  | "googleCalendar";

export type ScheduleDefaults = Partial<Pick<ScheduleValues, Remembered>>;

/** Which of the form's choices the host has right now. */
type Offered = {
  /** Their meetings offer AI notes (Settings → AI notes). */
  aiNotes: boolean;
  /** Google Calendar is connected, so the form offers adding the meeting to it. */
  calendar: boolean;
};

// Each option on its own: one that isn't valid any more drops out, the rest stay.
const option = <T extends z.ZodType>(schema: T) =>
  schema.optional().catch(undefined);

const Stored = z
  .object({
    durationMin: option(ScheduleInput.shape.durationMin),
    passcode: option(z.boolean()),
    waitingRoom: option(z.boolean()),
    allowGuests: option(z.boolean()),
    joinBeforeHost: option(z.boolean()),
    muteOnEntry: option(z.boolean()),
    autoNotes: option(z.boolean()),
    shareNotes: option(z.boolean()),
    googleCalendar: option(z.boolean()),
  })
  .catch({});

const definedOnly = <T extends object>(values: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

/** What's stored, as far as it's still valid. */
export function readScheduleDefaults(stored: unknown): ScheduleDefaults {
  return definedOnly(Stored.parse(stored));
}

/**
 * Where the schedule form starts: the remembered options this host is offered now. The
 * AI notes ones only where their meetings offer AI notes, Google Calendar's only where
 * it's connected; otherwise the form's own defaults.
 */
export function rememberedOptions(
  stored: unknown,
  offered: Offered,
): ScheduleDefaults {
  const { autoNotes, shareNotes, googleCalendar, ...always } =
    readScheduleDefaults(stored);
  return {
    ...always,
    ...(offered.aiNotes ? definedOnly({ autoNotes, shareNotes }) : {}),
    ...(offered.calendar ? definedOnly({ googleCalendar }) : {}),
  };
}

/**
 * What to remember after scheduling a meeting: the options it used. The AI notes and
 * Google Calendar choices only where they were offered, so turning AI notes off for a
 * while, or disconnecting Calendar, doesn't lose them.
 */
export function nextScheduleDefaults(
  stored: unknown,
  used: Pick<ScheduleValues, Remembered>,
  offered: Offered,
): ScheduleDefaults {
  return {
    ...readScheduleDefaults(stored),
    durationMin: used.durationMin,
    passcode: used.passcode,
    waitingRoom: used.waitingRoom,
    allowGuests: used.allowGuests,
    joinBeforeHost: used.joinBeforeHost,
    muteOnEntry: used.muteOnEntry,
    ...(offered.aiNotes
      ? { autoNotes: used.autoNotes, shareNotes: used.shareNotes }
      : {}),
    ...(offered.calendar ? { googleCalendar: used.googleCalendar } : {}),
  };
}
