import { isTimeZone } from "@/lib/time";
import { z } from "@/lib/zod";

/**
 * Email reminders (Settings → Notifications): off to start, for people with an account.
 * When one is on, the server emails before each meeting they host or are invited to.
 */

/** How long before a meeting the email comes, in minutes: the choices offered. */
export const EMAIL_REMINDER_MINUTES = [10, 30, 60, 1440] as const;
export type EmailReminderMinutes = (typeof EMAIL_REMINDER_MINUTES)[number];

/**
 * What the account keeps when they're on: how long before, and the time zone the emails
 * give times in (the person's own, saved with the choice). Null when off.
 */
export const EmailReminders = z.object({
  minutes: z.union(EMAIL_REMINDER_MINUTES.map((m) => z.literal(m))),
  timeZone: z.string().refine(isTimeZone),
});
export type EmailReminders = z.infer<typeof EmailReminders>;

/** A choice from the settings page: 0 turns them off. */
export const EmailRemindersChoice = z.object({
  minutes: z.union([
    z.literal(0),
    ...EMAIL_REMINDER_MINUTES.map((m) => z.literal(m)),
  ]),
  timeZone: z.string().refine(isTimeZone),
});

/** What's stored, read safely: anything that isn't a valid setting counts as off. */
export function readEmailReminders(stored: unknown): EmailReminders | null {
  const parsed = EmailReminders.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/**
 * How far ahead reminder emails are scheduled with Resend, by when they go. The daily sweep
 * tops this up, so it overlaps a day: a sweep that doesn't run still leaves a day's
 * reminders scheduled. (Resend takes them up to 30 days ahead.)
 */
export const HORIZON_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * A reminder this close to going out (or already gone) is left as it is: Resend may be
 * sending it, so it's never cancelled, replaced or sent again.
 */
export const SETTLED_MS = 2 * 60 * 1000;

/** When the reminder for a meeting starting at `start` goes. */
export const sendTime = (start: Date, minutes: number) =>
  new Date(start.getTime() - minutes * 60_000);

/**
 * Whether a reminder going at `sendAt` is scheduled now: it's still ahead, past the
 * settled margin, and within the horizon. One whose moment has passed isn't sent late.
 */
export function inHorizon(sendAt: Date, now: Date, horizonMs = HORIZON_MS) {
  const at = sendAt.getTime();
  return at > now.getTime() + SETTLED_MS && at <= now.getTime() + horizonMs;
}

/** The starts to look at for one lead time: those whose reminder could be in the horizon. */
export function startWindow(
  minutes: number,
  now: Date,
  horizonMs = HORIZON_MS,
): { from: Date; to: Date } {
  const lead = minutes * 60_000;
  return {
    from: new Date(now.getTime() + SETTLED_MS + lead),
    to: new Date(now.getTime() + horizonMs + lead + 1),
  };
}

/** Midnight UTC that began `now`'s day: the daily cap counts from there. */
export const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** A reminder email someone should get: which occurrence, when it goes, and what it says. */
export type WantedReminder = {
  /** The occurrence: the meeting's ID and the start reminded about. */
  key: string;
  sendAt: Date;
  /** A hash of the email, so a change to it (or to when it goes) means a new one. */
  fingerprint: string;
};

/** A reminder email as recorded: scheduled with Resend, or already sent. */
export type ScheduledReminder = {
  key: string;
  /** Null on rows from before reminders were scheduled ahead: those were sent. */
  sendAt: Date | null;
  /** Resend's ID; null while it's being scheduled, or if that was interrupted. */
  emailId: string | null;
  fingerprint: string | null;
};

/**
 * What to change so the scheduled reminder emails match the wanted ones:
 * - `cancel`: scheduled ones no longer wanted, or wanted differently (a new title or time,
 *   or another lead time), which get cancelled first and scheduled again;
 * - `resume`: ones whose scheduling was interrupted, to finish with the same request;
 * - `schedule`: wanted ones not yet scheduled, soonest first, while their day (UTC) stays
 *   within the cap; `held` counts the rest.
 * One that's settled (sent, or about to be) is never touched, and never sent again.
 * `perDay` counts everyone's reminder emails already scheduled or sent, by day (midnight
 * UTC, in ms); the plan gives it back as it will be once carried out.
 */
export function planReminders<
  W extends WantedReminder,
  S extends ScheduledReminder,
>(input: {
  wanted: readonly W[];
  scheduled: readonly S[];
  now: Date;
  cap: number;
  perDay: ReadonlyMap<number, number>;
}): {
  cancel: S[];
  resume: S[];
  schedule: W[];
  held: number;
  perDay: Map<number, number>;
} {
  const wanted = new Map(input.wanted.map((want) => [want.key, want]));
  const perDay = new Map(input.perDay);
  const cancel: S[] = [];
  const resume: S[] = [];
  const settledBy = input.now.getTime() + SETTLED_MS;

  for (const row of input.scheduled) {
    const want = wanted.get(row.key);
    if (row.sendAt === null || row.sendAt.getTime() <= settledBy) {
      wanted.delete(row.key);
      continue;
    }
    const same =
      want !== undefined &&
      want.fingerprint === row.fingerprint &&
      want.sendAt.getTime() === row.sendAt.getTime();
    if (same) {
      wanted.delete(row.key);
      if (row.emailId === null) resume.push(row);
      continue;
    }
    cancel.push(row);
    const day = startOfUtcDay(row.sendAt).getTime();
    perDay.set(day, Math.max(0, (perDay.get(day) ?? 0) - 1));
  }

  const schedule: W[] = [];
  let held = 0;
  const soonestFirst = [...wanted.values()].sort(
    (a, b) => a.sendAt.getTime() - b.sendAt.getTime(),
  );
  for (const want of soonestFirst) {
    const day = startOfUtcDay(want.sendAt).getTime();
    const used = perDay.get(day) ?? 0;
    if (used >= input.cap) {
      held++;
      continue;
    }
    perDay.set(day, used + 1);
    schedule.push(want);
  }
  return { cancel, resume, schedule, held, perDay };
}
