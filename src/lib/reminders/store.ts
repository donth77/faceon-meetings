import "server-only";

import { and, eq, gt, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { meeting, meetingInvitee, reminderSent, user } from "@/lib/db/schema";

import { remindersChanged } from "./changed";
import { readEmailReminders, type EmailReminders } from "./rules";

/** Someone's email reminders as Settings shows them: null when off. */
export async function emailRemindersFor(
  userId: string,
): Promise<EmailReminders | null> {
  const [row] = await db()
    .select({ value: user.emailReminders })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return readEmailReminders(row?.value ?? null);
}

/**
 * Turns email reminders on (with when, and the time zone) or off (null), then schedules or
 * cancels their emails to match.
 */
export async function saveEmailReminders(
  userId: string,
  value: EmailReminders | null,
): Promise<void> {
  await db()
    .update(user)
    .set({ emailReminders: value })
    .where(eq(user.id, userId));
  remindersChanged({ userId });
}

export type ReminderRecipient = {
  id: string;
  name: string;
  email: string;
  locale: string | null;
  reminders: EmailReminders;
};

const recipientFields = {
  id: user.id,
  name: user.name,
  email: user.email,
  locale: user.locale,
  value: user.emailReminders,
};

const wantsReminders = and(
  isNotNull(user.emailReminders),
  eq(user.emailVerified, true),
);

function toRecipients(
  rows: {
    id: string;
    name: string;
    email: string;
    locale: string | null;
    value: unknown;
  }[],
): ReminderRecipient[] {
  return rows.flatMap((row) => {
    const reminders = readEmailReminders(row.value);
    return reminders ? [{ ...row, reminders }] : [];
  });
}

/** Everyone with email reminders on and a verified address: no one else is ever emailed. */
export async function reminderRecipients(): Promise<ReminderRecipient[]> {
  return toRecipients(
    await db().select(recipientFields).from(user).where(wantsReminders),
  );
}

/** One person, when they have reminders on and a verified address; otherwise null. */
export async function reminderRecipient(
  userId: string,
): Promise<ReminderRecipient | null> {
  const rows = await db()
    .select(recipientFields)
    .from(user)
    .where(and(eq(user.id, userId), wantsReminders))
    .limit(1);
  return toRecipients(rows)[0] ?? null;
}

/** A meeting's ID code (the 10 digits), or null when it's gone. */
export async function meetingCodeOf(meetingId: string): Promise<string | null> {
  const [row] = await db()
    .select({ code: meeting.code })
    .from(meeting)
    .where(eq(meeting.id, meetingId))
    .limit(1);
  return row?.code ?? null;
}

/**
 * The people a meeting's reminders can go to: its host, and invitees whose verified
 * address has an account with reminders on.
 */
export async function peopleRemindedOf(meetingId: string): Promise<string[]> {
  const [host, invited] = await Promise.all([
    db()
      .select({ id: meeting.hostId })
      .from(meeting)
      .where(eq(meeting.id, meetingId)),
    db()
      .select({ id: user.id })
      .from(user)
      .innerJoin(
        meetingInvitee,
        eq(meetingInvitee.email, sql`lower(${user.email})`),
      )
      .where(and(eq(meetingInvitee.meetingId, meetingId), wantsReminders)),
  ]);
  return [...new Set([...host, ...invited].map((row) => row.id))];
}

/** One reminder email as recorded: scheduled with Resend, or already sent. */
export type ReminderRecord = {
  meetingCode: string;
  startsAt: Date;
  sendAt: Date | null;
  emailId: string | null;
  fingerprint: string | null;
  nonce: string | null;
};

/** Which reminder a row is: the person, the meeting's ID and the start reminded about. */
export type ReminderKey = {
  userId: string;
  meetingCode: string;
  startsAt: Date;
};

const keyIs = (key: ReminderKey) =>
  and(
    eq(reminderSent.userId, key.userId),
    eq(reminderSent.meetingCode, key.meetingCode),
    eq(reminderSent.startsAt, key.startsAt),
  );

const recordFields = {
  meetingCode: reminderSent.meetingCode,
  startsAt: reminderSent.startsAt,
  sendAt: reminderSent.sendAt,
  emailId: reminderSent.emailId,
  fingerprint: reminderSent.fingerprint,
  nonce: reminderSent.nonce,
};

/** Someone's reminder emails for meetings that haven't started yet. */
export async function remindersOf(
  userId: string,
  now: Date,
): Promise<ReminderRecord[]> {
  return db()
    .select(recordFields)
    .from(reminderSent)
    .where(
      and(eq(reminderSent.userId, userId), gt(reminderSent.startsAt, now)),
    );
}

/**
 * Records a reminder email before it's scheduled, so two runs at once can't both make it.
 * False when that occurrence already has one.
 */
export async function claimReminder(
  key: ReminderKey & { sendAt: Date; fingerprint: string; nonce: string },
): Promise<boolean> {
  const inserted = await db()
    .insert(reminderSent)
    .values(key)
    .onConflictDoNothing()
    .returning({ userId: reminderSent.userId });
  return inserted.length > 0;
}

/** Notes Resend's ID for a reminder email once Resend has it. */
export async function recordReminderEmail(
  key: ReminderKey,
  emailId: string,
): Promise<void> {
  await db().update(reminderSent).set({ emailId }).where(keyIs(key));
}

/** Marks a reminder email as gone, so it's never cancelled or sent again. */
export async function settleReminder(key: ReminderKey, now: Date) {
  await db().update(reminderSent).set({ sendAt: now }).where(keyIs(key));
}

/** Forgets a reminder email: cancelled, or never scheduled after all. */
export async function forgetReminder(key: ReminderKey): Promise<void> {
  await db().delete(reminderSent).where(keyIs(key));
}

/**
 * How many reminder emails (everyone's) go on each day (midnight UTC, in ms) from `from`
 * on, scheduled or sent: the daily cap counts them. Older rows count by when they went.
 */
export async function remindersPerDay(
  from: Date,
): Promise<Map<number, number>> {
  const when = sql<Date>`coalesce(${reminderSent.sendAt}, ${reminderSent.sentAt})`;
  const rows = await db()
    .select({ when })
    .from(reminderSent)
    .where(gte(when, from));
  const perDay = new Map<number, number>();
  for (const row of rows) {
    const at = new Date(row.when);
    const day = Date.UTC(
      at.getUTCFullYear(),
      at.getUTCMonth(),
      at.getUTCDate(),
    );
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return perDay;
}

/** People with reminder emails still waiting: the daily run checks them too. */
export async function peopleWithWaitingReminders(now: Date): Promise<string[]> {
  const rows = await db()
    .selectDistinct({ id: reminderSent.userId })
    .from(reminderSent)
    .where(gt(reminderSent.sendAt, now));
  return rows.map((row) => row.id);
}

/** People with reminder emails for a meeting that hasn't happened yet. */
export async function peopleWithRemindersFor(
  meetingCode: string,
  now: Date,
): Promise<string[]> {
  const rows = await db()
    .selectDistinct({ id: reminderSent.userId })
    .from(reminderSent)
    .where(
      and(
        eq(reminderSent.meetingCode, meetingCode),
        gt(reminderSent.startsAt, now),
      ),
    );
  return rows.map((row) => row.id);
}

/**
 * Reminder emails still waiting that involve an account: its own, and everyone's for the
 * meetings it hosts. They're cancelled when the account is deleted.
 */
export async function waitingRemindersOfAccount(
  userId: string,
  now: Date,
): Promise<(ReminderRecord & { userId: string })[]> {
  const hosted = db()
    .select({ code: meeting.code })
    .from(meeting)
    .where(eq(meeting.hostId, userId));
  return db()
    .select({ ...recordFields, userId: reminderSent.userId })
    .from(reminderSent)
    .where(
      and(
        gt(reminderSent.sendAt, now),
        or(
          eq(reminderSent.userId, userId),
          inArray(reminderSent.meetingCode, hosted),
        ),
      ),
    );
}

/** Forgets reminders for meetings that started before a moment (the sweep). */
export async function pruneSentReminders(before: Date): Promise<number> {
  const removed = await db()
    .delete(reminderSent)
    .where(lt(reminderSent.startsAt, before))
    .returning({ userId: reminderSent.userId });
  return removed.length;
}
