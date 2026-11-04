/**
 * Settings → Admin → Usage this month, as pure rules: how much of each free allowance is
 * used, when that's worth a warning, and which warnings are due. The readings come from
 * stream.ts, emails.ts and neon.ts; alerts.ts emails the admins.
 */

/**
 * What's measured: Stream's participant-minutes, the emails sent in a day and in a
 * month (against Resend's limits, and Mailtrap's where it's the backup), and Neon's
 * compute hours.
 */
export type MeterId =
  | "stream"
  | "emailsDay"
  | "emailsMonth"
  | "mailtrapDay"
  | "mailtrapMonth"
  | "neon";

/** Admins are emailed when a meter reaches each of these percentages, once per period. */
export const THRESHOLDS = [80, 100] as const;
export type Threshold = (typeof THRESHOLDS)[number];

export type MeterStatus = "ok" | "near" | "over";

/** Whether `used` has reached `percent` of `limit`, in whole numbers so 80% means 80%. */
const reached = (used: number, limit: number, percent: number) =>
  used * 100 >= percent * limit;

/** The share of an allowance used (1 is all of it), or null where there's no limit. */
export function usedShare(used: number, limit: number): number | null {
  return limit > 0 ? Math.max(0, used) / limit : null;
}

/** Near the limit from the first threshold, over it at 100%; a meter without a limit is fine. */
export function meterStatus(used: number, limit: number): MeterStatus {
  if (limit <= 0) return "ok";
  if (reached(used, limit, 100)) return "over";
  return reached(used, limit, THRESHOLDS[0]) ? "near" : "ok";
}

/** The UTC calendar month around `now`: its start, the next one's, and its key ("2026-11"). */
export function utcMonth(now: Date): { start: Date; end: Date; key: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, end, key: start.toISOString().slice(0, 7) };
}

/** The UTC day of an instant, as YYYY-MM-DD. */
export const utcDay = (at: Date): string => at.toISOString().slice(0, 10);

/** The UTC day before `day` (YYYY-MM-DD). */
export function dayBefore(day: string): string {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return utcDay(at);
}

/**
 * One connection to a call: when it joined, when it left if it has, and when its
 * session ended if it has.
 */
export type Connection = {
  joinedAt: Date;
  leftAt: Date | null;
  endedAt: Date | null;
};

/**
 * Participant-minutes in a window, counted the way Stream bills them: each person's
 * time connected, from joining to leaving. A connection still open counts until now,
 * and one whose leaving was never heard (a missed webhook) ends with its session.
 */
export function participantMinutes(
  connections: readonly Connection[],
  window: { start: Date; end: Date },
  now: Date,
): number {
  const until = Math.min(window.end.getTime(), now.getTime());
  let ms = 0;
  for (const connection of connections) {
    const from = Math.max(
      connection.joinedAt.getTime(),
      window.start.getTime(),
    );
    const left = connection.leftAt ?? connection.endedAt ?? now;
    const to = Math.min(left.getTime(), until);
    if (to > from) ms += to - from;
  }
  return ms / 60_000;
}

/**
 * A meter's reading, for warnings: the period it counts over, how much is used of how
 * much, and for a day's emails, which day.
 */
export type Reading = {
  meter: MeterId;
  period: string;
  used: number;
  limit: number;
  day?: string;
};

export type Alert = Reading & {
  threshold: Threshold;
  /** Lower thresholds this warning stands for, remembered as sent with it. */
  covers: Threshold[];
};

/** How a warning that went is remembered: once per meter, period and threshold. */
export const alertKey = (meter: string, period: string, threshold: number) =>
  `${meter}|${period}|${threshold}`;

/**
 * The warnings due: for each meter with a limit, the highest threshold it has reached,
 * unless that one went already. A meter that jumps straight past 100% gets one email,
 * not two; the 80% one it stands for is remembered as sent too.
 */
export function alertsDue(
  readings: readonly Reading[],
  sent: ReadonlySet<string>,
): Alert[] {
  const due: Alert[] = [];
  for (const reading of readings) {
    if (reading.limit <= 0) continue;
    const passed = THRESHOLDS.filter((threshold) =>
      reached(reading.used, reading.limit, threshold),
    );
    const highest = passed.at(-1);
    if (
      highest === undefined ||
      sent.has(alertKey(reading.meter, reading.period, highest))
    ) {
      continue;
    }
    due.push({
      ...reading,
      threshold: highest,
      covers: passed.filter(
        (threshold) =>
          threshold < highest &&
          !sent.has(alertKey(reading.meter, reading.period, threshold)),
      ),
    });
  }
  return due;
}

/**
 * A count from one of Resend's quota headers (x-resend-daily-quota,
 * x-resend-monthly-quota: what's used so far), or null when it's missing or odd.
 */
export function quotaHeader(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const count = Number(value.trim());
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/** A count of emails: FaceOn's own, and Resend's when it reported one. */
export type EmailCount = { sent: number; resend: number | null };

/** How many emails count against a limit: FaceOn's, or Resend's where it says more. */
export const emailsUsed = (count: EmailCount) =>
  Math.max(count.sent, count.resend ?? 0);

/**
 * Whether an email allowance is used up, today's or the month's (a limit of 0 is none):
 * emails that go now then try the next provider first (lib/email/send.ts).
 */
export function allowanceSpent(
  counts: { today: EmailCount; month: EmailCount },
  limits: { perDay: number; perMonth: number },
): boolean {
  return (
    meterStatus(emailsUsed(counts.today), limits.perDay) === "over" ||
    meterStatus(emailsUsed(counts.month), limits.perMonth) === "over"
  );
}

/**
 * One of the account's emails as Resend lists them: when it was made, when it's
 * scheduled to go (if it is), whether it was cancelled, and how many recipients it has
 * (Resend's quota counts each one).
 */
export type ListedEmail = {
  createdAt: Date;
  scheduledAt: Date | null;
  cancelled: boolean;
  recipients: number;
};

/**
 * Resend's timestamps ("2026-11-04 13:27:37.47+00"), as instants; null when one can't
 * be read.
 */
export function resendInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value
    .trim()
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * The account's emails per UTC day, each on the day it goes (a scheduled one on its
 * day, not the day it was made) and once per recipient; cancelled ones never go.
 */
export function emailsByDay(
  emails: readonly ListedEmail[],
): Map<string, number> {
  const days = new Map<string, number>();
  for (const email of emails) {
    if (email.cancelled) continue;
    const day = utcDay(email.scheduledAt ?? email.createdAt);
    days.set(day, (days.get(day) ?? 0) + Math.max(1, email.recipients));
  }
  return days;
}
