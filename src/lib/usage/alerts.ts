import "server-only";

import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Locale } from "next-intl";

import { db } from "@/lib/db";
import { usageAlert, user } from "@/lib/db/schema";
import { sendEmail, type Email } from "@/lib/email/send";
import { accountEmail, emailLocale } from "@/lib/email/templates";
import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import { alertKey, alertsDue, type Alert } from "./meters";
import { readingsOf, usageReport } from "./usage";

/** Noon UTC on a day (YYYY-MM-DD), so it reads as that day in nearly every time zone. */
const noonOf = (day: string) => new Date(`${day}T12:00:00Z`).getTime();

/** The amount in an email: whole minutes and emails, compute hours to a tenth. */
const shown = (alert: Alert) =>
  alert.meter === "neon"
    ? Math.round(alert.used * 10) / 10
    : Math.round(alert.used);

/**
 * The warning about one meter, to one admin: how much of how much, linking to Settings →
 * Admin → Usage this month. At 80% it says another comes at 100%; at 100%, that it's
 * the last until the next period.
 */
export function usageAlertEmail(
  alert: Alert,
  to: string,
  locale: Locale,
): Promise<Email> {
  return accountEmail("usageAlert", {
    to,
    name: "",
    url: `${siteUrl()}/settings/admin#usage`,
    locale,
    values: {
      meter: alert.meter,
      share: alert.used / alert.limit,
      used: shown(alert),
      limit: alert.limit,
      day: alert.day ? noonOf(alert.day) : 0,
      next: alert.threshold < 100 ? "full" : "period",
    },
  });
}

/** Emails one warning to every admin, each in their own language where they have an account. */
async function emailAdmins(alert: Alert): Promise<void> {
  const admins = serverEnv().ADMIN_EMAILS;
  const accounts = await db()
    .select({ email: user.email, locale: user.locale })
    .from(user)
    .where(inArray(sql<string>`lower(${user.email})`, admins));
  for (const address of admins) {
    const account = accounts.find(
      (found) => found.email.toLowerCase() === address,
    );
    await sendEmail(
      await usageAlertEmail(alert, address, emailLocale(account ?? {})),
    );
  }
}

/**
 * Warns the admins (ADMIN_EMAILS) when a free allowance reaches 80% and again at 100%,
 * once each per meter and period: run by the daily sweep. A warning is claimed before
 * it's sent, so two runs at once can't both send it, and released if sending fails, so
 * the next run tries again. Returns how many warnings went.
 */
export async function warnAboutUsage(now = new Date()): Promise<number> {
  const env = serverEnv();
  const canEmail =
    process.env.NODE_ENV === "development" ||
    Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
  if (env.ADMIN_EMAILS.length === 0 || !canEmail) return 0;

  const readings = readingsOf(await usageReport(now));
  if (readings.length === 0) return 0;
  const sentRows = await db()
    .select({
      meter: usageAlert.meter,
      period: usageAlert.period,
      threshold: usageAlert.threshold,
    })
    .from(usageAlert)
    .where(
      inArray(
        usageAlert.period,
        readings.map((reading) => reading.period),
      ),
    );
  const sent = new Set(
    sentRows.map((row) => alertKey(row.meter, row.period, row.threshold)),
  );

  let warned = 0;
  for (const alert of alertsDue(readings, sent)) {
    const thresholds = [alert.threshold, ...alert.covers];
    const claimed = await db()
      .insert(usageAlert)
      .values(
        thresholds.map((threshold) => ({
          meter: alert.meter,
          period: alert.period,
          threshold,
        })),
      )
      .onConflictDoNothing()
      .returning({ threshold: usageAlert.threshold });
    if (!claimed.some((row) => row.threshold === alert.threshold)) continue;
    try {
      await emailAdmins(alert);
      warned++;
    } catch (error) {
      reportError("A usage warning failed to send", error);
      await db()
        .delete(usageAlert)
        .where(
          and(
            eq(usageAlert.meter, alert.meter),
            eq(usageAlert.period, alert.period),
            inArray(
              usageAlert.threshold,
              claimed.map((row) => row.threshold),
            ),
          ),
        );
    }
  }
  return warned;
}

/** Drops warnings sent before `before` (retention.ts). */
export async function pruneUsageAlerts(before: Date): Promise<number> {
  const deleted = await db()
    .delete(usageAlert)
    .where(lt(usageAlert.sentAt, before))
    .returning({ meter: usageAlert.meter });
  return deleted.length;
}
