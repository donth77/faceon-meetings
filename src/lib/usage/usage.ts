import "server-only";

import { mailtrapConfig, resendConfig } from "@/lib/email/providers";
import { serverEnv } from "@/lib/server-env";

import { emailUsage, type EmailUsage } from "./emails";
import {
  emailsUsed,
  inUsageOrder,
  utcMonth,
  type EmailCount,
  type Reading,
} from "./meters";
import { neonUsage, type NeonUsage } from "./neon";
import type { Listing } from "./resend";
import { streamAttendanceMissing, streamMinutesThisMonth } from "./stream";

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
    /** The latest call that ran a minute or more has no attendance: the webhook isn't arriving. */
    attendanceMissing: boolean;
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
  /** Mailtrap, the backup for emails that go now: FaceOn's count of what it sent. */
  mailtrap: EmailUsage["mailtrap"] & {
    configured: boolean;
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
  const [minutes, attendanceMissing, { mailtrap, ...emails }, neon] =
    await Promise.all([
      streamConfigured ? streamMinutesThisMonth(now) : 0,
      streamConfigured ? streamAttendanceMissing() : false,
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
      attendanceMissing,
    },
    emails: {
      configured: resendConfig() !== null,
      ...emails,
      perDay: env.USAGE_EMAILS_PER_DAY,
      perMonth: env.USAGE_EMAILS_PER_MONTH,
    },
    mailtrap: {
      configured: mailtrapConfig() !== null,
      ...mailtrap,
      perDay: env.USAGE_MAILTRAP_PER_DAY,
      perMonth: env.USAGE_MAILTRAP_PER_MONTH,
    },
    neon: { ...neon, limit: env.USAGE_NEON_CU_HOURS },
  };
}

/**
 * What the daily sweep checks, most critical first (USAGE_ORDER): this month's Stream
 * minutes, Neon's billing period, and emails (Resend's, and Mailtrap's where it's the
 * backup), with yesterday's emails against a day's limit (the day is over by then).
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
  if (report.mailtrap.configured) {
    readings.push(
      {
        meter: "mailtrapDay",
        period: report.month,
        used: report.mailtrap.yesterday,
        limit: report.mailtrap.perDay,
        day: report.emails.yesterday.day,
      },
      {
        meter: "mailtrapMonth",
        period: report.month,
        used: report.mailtrap.month,
        limit: report.mailtrap.perMonth,
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
  return inUsageOrder(readings);
}
