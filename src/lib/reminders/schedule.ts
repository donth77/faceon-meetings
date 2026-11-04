import "server-only";

import { randomBytes } from "node:crypto";
import { getTranslations } from "next-intl/server";

import {
  cancelScheduledEmail,
  canScheduleEmail,
  sendEmail,
  type Email,
} from "@/lib/email/send";
import { emailLocale } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { upcomingFor } from "@/lib/meetings/scheduling";
import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import type { ReminderChange } from "./changed";
import { reminderEmail, type ReminderText } from "./email";
import { fingerprintOf, idempotencyKey } from "./fingerprint";
import {
  inHorizon,
  planReminders,
  sendTime,
  startOfUtcDay,
  startWindow,
} from "./rules";
import {
  claimReminder,
  forgetReminder,
  meetingCodeOf,
  peopleRemindedOf,
  peopleWithRemindersFor,
  peopleWithWaitingReminders,
  recordReminderEmail,
  reminderRecipient,
  reminderRecipients,
  remindersOf,
  remindersPerDay,
  settleReminder,
  waitingRemindersOfAccount,
  type ReminderKey,
  type ReminderRecipient,
} from "./store";
import { unsubscribeToken } from "./token";

/*
 * Reminder emails are scheduled with Resend ahead of time, not sent by a job polling every
 * few minutes (which would keep the database from ever sleeping). Each person's reminders
 * within the horizon (rules.ts) are brought in line with their settings and meetings when
 * either changes (changed.ts), and for everyone once a day by the sweep, which also
 * schedules the reminders that have come into the horizon since.
 */

/** Space between calls to Resend, well inside its rate limit. */
const SPACING_MS = 250;
/** A cancel Resend can't do yet (the email is still being scheduled) is tried again. */
const CANCEL_TRIES = 3;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What bringing reminders in line did. */
export type ReminderStats = {
  people: number;
  scheduled: number;
  cancelled: number;
  held: number;
  failed: number;
};

async function translator(locale: ReturnType<typeof emailLocale>) {
  const emails = await getTranslations({ locale, namespace: "Emails" });
  const reminder = await getTranslations({
    locale,
    namespace: "Emails.reminder",
  });
  const t: ReminderText = (key, values) =>
    key === "linkFallback" ? emails("linkFallback") : reminder(key, values);
  return t;
}

const keyOf = (meetingCode: string, startsAt: Date) =>
  `${meetingCode}|${startsAt.toISOString()}`;

type Wanted = {
  key: string;
  meetingCode: string;
  startsAt: Date;
  sendAt: Date;
  fingerprint: string;
  email: Email;
};

/**
 * The reminder emails someone should have scheduled now: one for each meeting they host or
 * are invited to (each occurrence of a series, as moved or cancelled) whose reminder goes
 * within the horizon, written as it will read when it goes.
 */
async function wantedFor(
  recipient: ReminderRecipient,
  now: Date,
  secret: string,
): Promise<Wanted[]> {
  const { minutes, timeZone } = recipient.reminders;
  const window = startWindow(minutes, now);
  const upcoming = await upcomingFor({
    userId: recipient.id,
    verifiedEmail: recipient.email,
    from: window.from,
    to: window.to,
  });
  if (upcoming.length === 0) return [];
  const site = siteUrl();
  const locale = emailLocale(recipient);
  const t = await translator(locale);
  const token = encodeURIComponent(unsubscribeToken(recipient.id, secret));
  return upcoming.flatMap((occurrence) => {
    const sendAt = sendTime(occurrence.start, minutes);
    if (!inHorizon(sendAt, now)) return [];
    const email = reminderEmail({
      to: recipient.email,
      occurrence,
      timeZone,
      locale,
      now: sendAt,
      siteUrl: site,
      appName: publicEnv.NEXT_PUBLIC_APP_NAME,
      stopUrl: `${site}/unsubscribe?token=${token}`,
      oneClickUrl: `${site}/api/email/unsubscribe?token=${token}`,
      t,
    });
    return [
      {
        key: keyOf(occurrence.code, occurrence.start),
        meetingCode: occurrence.code,
        startsAt: occurrence.start,
        sendAt,
        fingerprint: fingerprintOf(email),
        email,
      },
    ];
  });
}

/**
 * Cancels one waiting reminder email and forgets it. True once it won't go, or went
 * already; false when Resend couldn't do it yet, so a later run tries again.
 */
async function cancelReminder(
  key: ReminderKey,
  emailId: string | null,
  now: Date,
): Promise<boolean> {
  // Never reached Resend: scheduling it failed, or was cut short.
  if (emailId === null) {
    await forgetReminder(key);
    return true;
  }
  for (let attempt = 1; attempt <= CANCEL_TRIES; attempt++) {
    const outcome = await cancelScheduledEmail(emailId);
    if (outcome === "cancelled") {
      await forgetReminder(key);
      return true;
    }
    if (outcome === "sent") {
      await settleReminder(key, now);
      return true;
    }
    if (attempt < CANCEL_TRIES) await pause(1000 * attempt);
  }
  return false;
}

/** Hands a reminder email to Resend to send at its time, and notes Resend's ID. */
async function hand(want: Wanted, key: ReminderKey, nonce: string) {
  const id = await sendEmail(want.email, {
    scheduledAt: want.sendAt,
    idempotencyKey: idempotencyKey(key, nonce),
  });
  if (id === null && process.env.NODE_ENV !== "development") {
    throw new Error("Resend didn't say which email it scheduled.");
  }
  // In development the email only prints, so there's no ID to keep.
  await recordReminderEmail(key, id ?? `local:${nonce}`);
}

/** Brings one person's scheduled reminder emails in line; gives back the day counts. */
async function reconcilePerson(
  userId: string,
  now: Date,
  perDay: Map<number, number>,
  stats: ReminderStats,
): Promise<Map<number, number>> {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  const recipient =
    secret && canScheduleEmail() ? await reminderRecipient(userId) : null;
  const wanted =
    recipient && secret ? await wantedFor(recipient, now, secret) : [];
  const scheduled = (await remindersOf(userId, now)).map((record) => ({
    ...record,
    key: keyOf(record.meetingCode, record.startsAt),
  }));
  const plan = planReminders({
    wanted,
    scheduled,
    now,
    cap: serverEnv().REMINDER_EMAILS_PER_DAY,
    perDay,
  });
  stats.people++;
  stats.held += plan.held;
  const counts = plan.perDay;
  const keyFor = (row: { meetingCode: string; startsAt: Date }) => ({
    userId,
    meetingCode: row.meetingCode,
    startsAt: row.startsAt,
  });

  for (const row of plan.cancel) {
    if (await cancelReminder(keyFor(row), row.emailId, now)) {
      stats.cancelled++;
    } else {
      stats.failed++;
    }
    await pause(SPACING_MS);
  }

  const wantedByKey = new Map(wanted.map((want) => [want.key, want]));
  for (const row of plan.resume) {
    const want = wantedByKey.get(row.key);
    if (!want || !row.nonce) continue;
    try {
      await hand(want, keyFor(row), row.nonce);
      stats.scheduled++;
    } catch (error) {
      reportError("A reminder email couldn't be scheduled", error);
      stats.failed++;
    }
    await pause(SPACING_MS);
  }

  for (const want of plan.schedule) {
    const key = keyFor(want);
    const nonce = randomBytes(12).toString("base64url");
    const claimed = await claimReminder({
      ...key,
      sendAt: want.sendAt,
      fingerprint: want.fingerprint,
      nonce,
    });
    // Another run has this occurrence already, or its old email wouldn't cancel yet.
    if (!claimed) continue;
    try {
      await hand(want, key, nonce);
      stats.scheduled++;
    } catch (error) {
      reportError("A reminder email couldn't be scheduled", error);
      await forgetReminder(key).catch(() => {});
      const day = startOfUtcDay(want.sendAt).getTime();
      counts.set(day, Math.max(0, (counts.get(day) ?? 0) - 1));
      stats.failed++;
    }
    await pause(SPACING_MS);
  }
  return counts;
}

async function reconcilePeople(
  people: readonly string[],
  now: Date,
): Promise<ReminderStats> {
  const stats: ReminderStats = {
    people: 0,
    scheduled: 0,
    cancelled: 0,
    held: 0,
    failed: 0,
  };
  if (people.length === 0) return stats;
  let perDay = await remindersPerDay(startOfUtcDay(now));
  for (const userId of people) {
    try {
      perDay = await reconcilePerson(userId, now, perDay, stats);
    } catch (error) {
      reportError("Reminder emails could not be updated", error);
      stats.failed++;
    }
  }
  return stats;
}

/** Brings the reminder emails a change touches in line: one person's, or a meeting's. */
export async function reconcileReminders(
  change: ReminderChange,
  now = new Date(),
): Promise<ReminderStats> {
  if ("userId" in change) return reconcilePeople([change.userId], now);
  const code = change.meetingCode ?? (await meetingCodeOf(change.meetingId));
  const [reminded, scheduled] = await Promise.all([
    peopleRemindedOf(change.meetingId),
    code ? peopleWithRemindersFor(code, now) : [],
  ]);
  return reconcilePeople([...new Set([...reminded, ...scheduled])], now);
}

/**
 * The daily run: everyone with reminders on, and everyone with reminder emails still
 * waiting (whose settings or meetings may have changed without a word).
 */
export async function reconcileAllReminders(
  now = new Date(),
): Promise<ReminderStats> {
  const [recipients, waiting] = await Promise.all([
    reminderRecipients(),
    peopleWithWaitingReminders(now),
  ]);
  return reconcilePeople(
    [...new Set([...recipients.map((r) => r.id), ...waiting])],
    now,
  );
}

/**
 * Before an account is deleted: cancels the reminder emails still waiting for it, and
 * everyone's for the meetings it hosts, while there's still a record of them.
 */
export async function cancelRemindersOfAccount(
  userId: string,
  now = new Date(),
): Promise<void> {
  for (const row of await waitingRemindersOfAccount(userId, now)) {
    await cancelReminder(
      {
        userId: row.userId,
        meetingCode: row.meetingCode,
        startsAt: row.startsAt,
      },
      row.emailId,
      now,
    ).catch((error: unknown) => {
      reportError("A reminder email couldn't be cancelled", error);
    });
    await pause(SPACING_MS);
  }
}
