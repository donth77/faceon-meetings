import "server-only";

import { serverEnv } from "@/lib/server-env";

import { emailUsage, type EmailUsage } from "./emails";
import { emailsUsed, utcMonth, type EmailCount, type Reading } from "./meters";
import { neonUsage, type NeonUsage } from "./neon";
import type { Listing } from "./resend";
import { streamMinutesThisMonth } from "./stream";

/** Everything Settings → Admin → Usage this month shows, and the daily sweep warns about. */
export type UsageReport = {
  /** The UTC month counted, as YYYY-MM. */
  month: string;
  /**
   * Stream's participant-minutes, by FaceOn's own count from its attendance records,
   * counted when the report was made (`countedAt`): Stream's server API reports call
   * statistics, not what it bills.
   */
  stream: {
    configured: boolean;
    minutes: number;
    limit: number;
    countedAt: Date;
  };
  emails: {
    configured: boolean;
    today: EmailCount;
    yesterday: EmailCount & { day: string };
    month: EmailCount;
    account: EmailUsage["account"];
    /** Whether Resend's list of the account's emails could be read. */
    listing: Listing;
    perDay: number;
    perMonth: number;
  };
  neon: NeonUsage & { limit: number };
};

/**
 * This month's usage of each free allowance, with the allowances themselves. What comes
 * from Resend and Neon is asked at most every five minutes; `force` asks regardless, as
 * the daily check does.
 */
export async function usageReport(
  now = new Date(),
  force = false,
): Promise<UsageReport> {
  const env = serverEnv();
  const streamConfigured = Boolean(
    env.NEXT_PUBLIC_STREAM_API_KEY && env.STREAM_API_SECRET,
  );
  const [minutes, emails, neon] = await Promise.all([
    streamConfigured ? streamMinutesThisMonth(now) : 0,
    emailUsage(now, force),
    neonUsage(now, force),
  ]);
  return {
    month: utcMonth(now).key,
    stream: {
      configured: streamConfigured,
      minutes,
      limit: env.USAGE_STREAM_MINUTES,
      countedAt: now,
    },
    emails: {
      configured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
      ...emails,
      perDay: env.USAGE_EMAILS_PER_DAY,
      perMonth: env.USAGE_EMAILS_PER_MONTH,
    },
    neon: { ...neon, limit: env.USAGE_NEON_CU_HOURS },
  };
}

/**
 * What the daily sweep checks: this month's Stream minutes and emails, yesterday's
 * emails against a day's limit (the day is over by then), and Neon's billing period.
 */
export function readingsOf(report: UsageReport): Reading[] {
  const readings: Reading[] = [];
  if (report.stream.configured) {
    readings.push({
      meter: "stream",
      period: report.month,
      used: report.stream.minutes,
      limit: report.stream.limit,
    });
  }
  if (report.emails.configured) {
    readings.push(
      {
        meter: "emailsDay",
        period: report.month,
        used: emailsUsed(report.emails.yesterday),
        limit: report.emails.perDay,
        day: report.emails.yesterday.day,
      },
      {
        meter: "emailsMonth",
        period: report.month,
        used: emailsUsed(report.emails.month),
        limit: report.emails.perMonth,
      },
    );
  }
  if (report.neon.state === "ok") {
    readings.push({
      meter: "neon",
      period:
        report.neon.periodStart?.toISOString().slice(0, 10) ?? report.month,
      used: report.neon.cuHours,
      limit: report.neon.limit,
    });
  }
  return readings;
}
