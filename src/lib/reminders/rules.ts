import { z } from "zod";

import { isTimeZone } from "@/lib/time";

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
 * How far back a run looks for reminders it hasn't sent yet, so a run or two that didn't
 * happen still catches up. Never once the meeting has started.
 */
export const LOOKBACK_MS = 30 * 60 * 1000;

/**
 * Whether a reminder `minutes` before `start` is due at `now`: its moment came within the
 * lookback, and the meeting hasn't started.
 */
export function reminderDue(
  start: Date,
  minutes: number,
  now: Date,
  lookbackMs = LOOKBACK_MS,
): boolean {
  const due = start.getTime() - minutes * 60_000;
  return (
    due <= now.getTime() &&
    due > now.getTime() - lookbackMs &&
    start.getTime() > now.getTime()
  );
}

/** The starts to look at for one lead time: those whose reminder could be due now. */
export function startWindow(
  minutes: number,
  now: Date,
  lookbackMs = LOOKBACK_MS,
): { from: Date; to: Date } {
  const lead = minutes * 60_000;
  return {
    from: new Date(Math.max(now.getTime(), now.getTime() - lookbackMs + lead)),
    to: new Date(now.getTime() + lead + 1),
  };
}

/** Midnight UTC that began `now`'s day: the daily cap counts from there. */
export const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * The reminders to send this run, soonest first, as many as the day's cap still allows.
 * The rest wait: a later run sends them while they're still due.
 */
export function withinCap<T extends { start: Date }>(
  due: readonly T[],
  cap: number,
  sentToday: number,
): { send: T[]; held: number } {
  const room = Math.max(0, cap - sentToday);
  const sorted = [...due].sort((a, b) => a.start.getTime() - b.start.getTime());
  return {
    send: sorted.slice(0, room),
    held: Math.max(0, sorted.length - room),
  };
}
