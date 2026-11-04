import "server-only";

import { and, eq, gte, isNotNull, lt, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailDay } from "@/lib/db/schema";
import { serverEnv } from "@/lib/server-env";

import {
  allowanceSpent,
  dayBefore,
  quotaHeader,
  utcDay,
  utcMonth,
  type EmailCount,
} from "./meters";
import { freshResendCounts, type Listing } from "./resend";

/**
 * Counts one email Resend accepted, on the day it goes (UTC): today, or for an email
 * scheduled ahead (a reminder), the day it's due. With it, the counts Resend reported in
 * its response, as of now, for the whole account: its free plan's daily count, and the
 * month's on every plan. Like the list's (resend.ts), they only ever raise what's known.
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
      resendVia: "headers",
    })
    .onConflictDoUpdate({
      target: emailDay.day,
      set: {
        resendDaily: sql`greatest(${emailDay.resendDaily}, excluded.resend_daily)`,
        resendMonthly: sql`greatest(${emailDay.resendMonthly}, excluded.resend_monthly)`,
        resendAt: now,
        resendVia: "headers",
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

/** Counts one email Mailtrap sent, today (UTC): as the backup, it only sends emails now. */
export async function recordMailtrapEmail(now = new Date()): Promise<void> {
  await db()
    .insert(emailDay)
    .values({ day: utcDay(now), mailtrapSent: 1 })
    .onConflictDoUpdate({
      target: emailDay.day,
      set: { mailtrapSent: sql`${emailDay.mailtrapSent} + 1` },
    });
}

export type EmailUsage = {
  /** Today (UTC). */
  today: EmailCount;
  /** Yesterday (UTC), which the daily sweep warns about once it's over. */
  yesterday: EmailCount & { day: string };
  /** This month (UTC): FaceOn's count, and Resend's for the whole account. */
  month: EmailCount;
  /**
   * Where Resend's latest figures came from and when: its list of the account's emails,
   * or its answer to the last email FaceOn sent. Null before Resend has said anything
   * this month.
   */
  account: { via: "list" | "headers"; at: Date } | null;
  /** Whether Resend's list of the account's emails could be read (resend.ts). */
  listing: Listing;
  /** What Mailtrap sent as the backup, by FaceOn's count: today, yesterday, this month. */
  mailtrap: { today: number; yesterday: number; month: number };
};

/**
 * The emails sent today, yesterday and this month: FaceOn's own count, and Resend's for
 * the whole account, brought up to date from Resend's list first when it's more than
 * five minutes old (or always, with `force`).
 */
export async function emailUsage(
  now = new Date(),
  force = false,
): Promise<EmailUsage> {
  const listing = await freshResendCounts(now, force);
  return { ...(await savedCounts(now)), listing };
}

/**
 * Whether Resend's free allowance is used up, today's or the month's, by the counts
 * already saved (Resend isn't asked): emails that go now then try the next provider first
 * (lib/email/send.ts).
 */
export async function resendSpent(now = new Date()): Promise<boolean> {
  const env = serverEnv();
  return allowanceSpent(await savedCounts(now), {
    perDay: env.USAGE_EMAILS_PER_DAY,
    perMonth: env.USAGE_EMAILS_PER_MONTH,
  });
}

/** The counts as saved, without asking Resend for newer ones. */
async function savedCounts(now: Date): Promise<Omit<EmailUsage, "listing">> {
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
        mailtrapSent: emailDay.mailtrapSent,
        resendDaily: emailDay.resendDaily,
      })
      .from(emailDay)
      .where(and(gte(emailDay.day, yesterday), lt(emailDay.day, monthEnd))),
    db()
      .select({
        sent: sum(emailDay.sent).mapWith(Number),
        mailtrapSent: sum(emailDay.mailtrapSent).mapWith(Number),
      })
      .from(emailDay)
      .where(and(gte(emailDay.day, monthStart), lt(emailDay.day, monthEnd))),
    db()
      .select({
        resendMonthly: emailDay.resendMonthly,
        resendAt: emailDay.resendAt,
        resendVia: emailDay.resendVia,
      })
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
  const rowOn = (day: string) => days.find((found) => found.day === day);
  const on = (day: string): EmailCount => {
    const row = rowOn(day);
    return { sent: row?.sent ?? 0, resend: row?.resendDaily ?? null };
  };
  return {
    today: on(today),
    yesterday: { ...on(yesterday), day: yesterday },
    month: {
      sent: total?.sent ?? 0,
      resend: latest?.resendMonthly ?? null,
    },
    account: latest?.resendAt
      ? { via: latest.resendVia ?? "headers", at: latest.resendAt }
      : null,
    mailtrap: {
      today: rowOn(today)?.mailtrapSent ?? 0,
      yesterday: rowOn(yesterday)?.mailtrapSent ?? 0,
      month: total?.mailtrapSent ?? 0,
    },
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
