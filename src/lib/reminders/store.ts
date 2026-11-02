import "server-only";

import { and, count, eq, gte, isNotNull, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { reminderSent, user } from "@/lib/db/schema";

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

/** Turns email reminders on (with when, and the time zone) or off (null). */
export async function saveEmailReminders(
  userId: string,
  value: EmailReminders | null,
): Promise<void> {
  await db()
    .update(user)
    .set({ emailReminders: value })
    .where(eq(user.id, userId));
}

export type ReminderRecipient = {
  id: string;
  name: string;
  email: string;
  locale: string | null;
  reminders: EmailReminders;
};

/** Everyone with email reminders on and a verified address: no one else is ever emailed. */
export async function reminderRecipients(): Promise<ReminderRecipient[]> {
  const rows = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
      value: user.emailReminders,
    })
    .from(user)
    .where(and(isNotNull(user.emailReminders), eq(user.emailVerified, true)));
  return rows.flatMap((row) => {
    const reminders = readEmailReminders(row.value);
    return reminders ? [{ ...row, reminders }] : [];
  });
}

/**
 * Claims one reminder before it's sent, so two runs at once can't both send it. False
 * when it was already sent (or claimed).
 */
export async function claimReminder(input: {
  userId: string;
  meetingCode: string;
  startsAt: Date;
}): Promise<boolean> {
  const inserted = await db()
    .insert(reminderSent)
    .values(input)
    .onConflictDoNothing()
    .returning({ userId: reminderSent.userId });
  return inserted.length > 0;
}

/** Gives a claim back when the email couldn't be sent, so a later run tries again. */
export async function releaseReminder(input: {
  userId: string;
  meetingCode: string;
  startsAt: Date;
}): Promise<void> {
  await db()
    .delete(reminderSent)
    .where(
      and(
        eq(reminderSent.userId, input.userId),
        eq(reminderSent.meetingCode, input.meetingCode),
        eq(reminderSent.startsAt, input.startsAt),
      ),
    );
}

/** Reminder emails sent since a moment: the daily cap counts them. */
export async function remindersSentSince(since: Date): Promise<number> {
  const [row] = await db()
    .select({ sent: count() })
    .from(reminderSent)
    .where(gte(reminderSent.sentAt, since));
  return row?.sent ?? 0;
}

/** Forgets reminders for meetings that started before a moment (the sweep). */
export async function pruneSentReminders(before: Date): Promise<number> {
  const removed = await db()
    .delete(reminderSent)
    .where(lt(reminderSent.startsAt, before))
    .returning({ userId: reminderSent.userId });
  return removed.length;
}
