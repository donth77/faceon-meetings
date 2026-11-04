import "server-only";

import { serverEnv } from "@/lib/server-env";

import { emailUsage, type EmailCount } from "./emails";
import { utcMonth, type Reading } from "./meters";
import { neonUsage, type NeonUsage } from "./neon";
import { streamMinutesThisMonth } from "./stream";

/** Everything Settings → Admin → Usage this month shows, and the daily sweep warns about. */
export type UsageReport = {
  /** The UTC month counted, as YYYY-MM. */
  month: string;
  stream: { configured: boolean; minutes: number; limit: number };
  emails: {
    configured: boolean;
    today: EmailCount;
    yesterday: EmailCount & { day: string };
    month: EmailCount;
    perDay: number;
    perMonth: number;
  };
  neon: NeonUsage & { limit: number };
};

/** How many emails count against a limit: FaceOn's, or Resend's where it says more. */
export const emailsUsed = (count: EmailCount) =>
  Math.max(count.sent, count.resend ?? 0);

/** This month's usage of each free allowance, with the allowances themselves. */
export async function usageReport(now = new Date()): Promise<UsageReport> {
  const env = serverEnv();
  const streamConfigured = Boolean(
    env.NEXT_PUBLIC_STREAM_API_KEY && env.STREAM_API_SECRET,
  );
  const [minutes, emails, neon] = await Promise.all([
    streamConfigured ? streamMinutesThisMonth(now) : 0,
    emailUsage(now),
    neonUsage(),
  ]);
  return {
    month: utcMonth(now).key,
    stream: {
      configured: streamConfigured,
      minutes,
      limit: env.USAGE_STREAM_MINUTES,
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
