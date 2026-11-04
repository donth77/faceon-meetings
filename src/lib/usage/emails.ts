import "server-only";

import { and, eq, gte, isNotNull, lt, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailDay } from "@/lib/db/schema";

import { dayBefore, quotaHeader, utcDay, utcMonth } from "./meters";
import { freshResendCounts, type Listing } from "./resend";

/**
 * Counts one email Resend accepted, on the day it goes (UTC): today, or for an email
 * scheduled ahead (a reminder), the day it's due. With it, the counts Resend reported in
 * its response, as of now: its free plan's daily count, and the month's on every plan.
 */
export async function recordSentEmail(
  headers: Headers,
  goesAt?: Date,
  now = new Date(),
): Promise<void> {
  await db()
    .insert(emailDay)
    .values({ day: utcDay(goesAt && goesAt > now ? goesAt : now), sent: 1 })
    .onConflictDoUpdate({
      target: emailDay.day,
      set: { sent: sql`${emailDay.sent} + 1` },
    });
  const daily = quotaHeader(headers.get("x-resend-daily-quota"));
  const monthly = quotaHeader(headers.get("x-resend-monthly-quota"));
  if (daily === null && monthly === null) return;
  await db()
    .insert(emailDay)
    .values({
      day: utcDay(now),
      resendDaily: daily,
      resendMonthly: monthly,
      resendAt: now,
    })
    .onConflictDoUpdate({
      target: emailDay.day,
      set: {
        resendDaily: sql`coalesce(excluded.resend_daily, ${emailDay.resendDaily})`,
        resendMonthly: sql`coalesce(excluded.resend_monthly, ${emailDay.resendMonthly})`,
        resendAt: now,
      },
    });
}

/**
 * Takes back the count of a scheduled email that was cancelled before it went (a
 * reminder for a meeting that moved, say), from the day it was due.
 */
export async function uncountEmail(goesAt: Date): Promise<void> {
  await db()
    .update(emailDay)
    .set({ sent: sql`greatest(${emailDay.sent} - 1, 0)` })
    .where(eq(emailDay.day, utcDay(goesAt)));
}

/** A count of emails: FaceOn's own, and Resend's when it reported one. */
export type EmailCount = { sent: number; resend: number | null };

export type EmailUsage = {
  /** Today (UTC). */
  today: EmailCount;
  /** Yesterday (UTC), which the daily sweep warns about once it's over. */
  yesterday: EmailCount & { day: string };
  /** This month (UTC): FaceOn's count, and Resend's for the whole account. */
  month: EmailCount;
  /** Whether Resend's list of the account's emails could be read (resend.ts). */
  listing: Listing;
};

/**
 * The emails sent today, yesterday and this month: FaceOn's own count, and Resend's for
 * the whole account, brought up to date from Resend's list first when it's stale.
 */
export async function emailUsage(now = new Date()): Promise<EmailUsage> {
  const listing = await freshResendCounts(now);
  const today = utcDay(now);
  const yesterday = dayBefore(today);
  const month = utcMonth(now);
  const monthStart = utcDay(month.start);
  const monthEnd = utcDay(month.end);
  const [days, [total], [latest]] = await Promise.all([
    db()
      .select({
        day: emailDay.day,
        sent: emailDay.sent,
        resendDaily: emailDay.resendDaily,
      })
      .from(emailDay)
      .where(and(gte(emailDay.day, yesterday), lt(emailDay.day, monthEnd))),
    db()
      .select({ sent: sum(emailDay.sent).mapWith(Number) })
      .from(emailDay)
      .where(and(gte(emailDay.day, monthStart), lt(emailDay.day, monthEnd))),
    db()
      .select({ resendMonthly: emailDay.resendMonthly })
      .from(emailDay)
      .where(
        and(
          gte(emailDay.day, monthStart),
          lt(emailDay.day, monthEnd),
          isNotNull(emailDay.resendMonthly),
        ),
      )
      .orderBy(sql`${emailDay.resendAt} desc nulls last`)
      .limit(1),
  ]);
  const on = (day: string): EmailCount => {
    const row = days.find((found) => found.day === day);
    return { sent: row?.sent ?? 0, resend: row?.resendDaily ?? null };
  };
  return {
    today: on(today),
    yesterday: { ...on(yesterday), day: yesterday },
    month: {
      sent: total?.sent ?? 0,
      resend: latest?.resendMonthly ?? null,
    },
    listing,
  };
}

/** Drops the days before `before` (retention.ts). */
export async function pruneEmailDays(before: Date): Promise<number> {
  const deleted = await db()
    .delete(emailDay)
    .where(lt(emailDay.day, utcDay(before)))
    .returning({ day: emailDay.day });
  return deleted.length;
}
