import "server-only";

import { getTranslations } from "next-intl/server";

import { sendEmail } from "@/lib/email/send";
import { emailLocale } from "@/lib/email/templates";
import { publicEnv } from "@/lib/env";
import { loggable } from "@/lib/log";
import { upcomingFor } from "@/lib/meetings/scheduling";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import { reminderEmail, type ReminderText } from "./email";
import { reminderDue, startOfUtcDay, startWindow, withinCap } from "./rules";
import {
  claimReminder,
  releaseReminder,
  reminderRecipients,
  remindersSentSince,
  type ReminderRecipient,
} from "./store";
import { unsubscribeToken } from "./token";

/** Resend's free plan takes two requests a second; this keeps under it. */
const SEND_SPACING_MS = 600;
/** Several failures in a row mean Resend is down: the rest wait for a later run. */
const MAX_FAILURES_IN_A_ROW = 3;

type Due = {
  recipient: ReminderRecipient;
  occurrence: Awaited<ReturnType<typeof upcomingFor>>[number];
  start: Date;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * Emails the reminders that are due: for everyone who turned them on, each meeting they
 * host or are invited to (each occurrence of a series, as moved or cancelled), once.
 * Soonest first, within a daily cap kept well under Resend's 100 emails a day so account
 * emails always get through. Run every few minutes by an outside scheduler.
 */
export async function sendDueReminders(now = new Date()) {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  const stats = { recipients: 0, due: 0, sent: 0, held: 0, failed: 0 };
  if (!secret) return stats;
  const recipients = await reminderRecipients();
  stats.recipients = recipients.length;

  const due: Due[] = [];
  for (const recipient of recipients) {
    const { minutes } = recipient.reminders;
    const window = startWindow(minutes, now);
    const upcoming = await upcomingFor({
      userId: recipient.id,
      verifiedEmail: recipient.email,
      from: window.from,
      to: window.to,
    }).catch((error: unknown) => {
      console.error("Reminders could not list meetings", loggable(error));
      return [];
    });
    for (const occurrence of upcoming) {
      if (reminderDue(occurrence.start, minutes, now)) {
        due.push({ recipient, occurrence, start: occurrence.start });
      }
    }
  }
  stats.due = due.length;
  if (due.length === 0) return stats;

  const cap = serverEnv().REMINDER_EMAILS_PER_DAY;
  const { send, held } = withinCap(
    due,
    cap,
    await remindersSentSince(startOfUtcDay(now)),
  );
  stats.held = held;

  const site = siteUrl();
  let failuresInARow = 0;
  for (const item of send) {
    const claim = {
      userId: item.recipient.id,
      meetingCode: item.occurrence.code,
      startsAt: item.start,
    };
    // Already sent, by an earlier run or one running at the same time.
    if (!(await claimReminder(claim))) continue;
    try {
      const locale = emailLocale(item.recipient);
      const token = encodeURIComponent(
        unsubscribeToken(item.recipient.id, secret),
      );
      await sendEmail(
        reminderEmail({
          to: item.recipient.email,
          occurrence: item.occurrence,
          timeZone: item.recipient.reminders.timeZone,
          locale,
          now,
          siteUrl: site,
          appName: publicEnv.NEXT_PUBLIC_APP_NAME,
          stopUrl: `${site}/unsubscribe?token=${token}`,
          oneClickUrl: `${site}/api/email/unsubscribe?token=${token}`,
          t: await translator(locale),
        }),
      );
      stats.sent++;
      failuresInARow = 0;
      if (stats.sent < send.length) await pause(SEND_SPACING_MS);
    } catch (error) {
      console.error("A reminder email failed to send", loggable(error));
      await releaseReminder(claim).catch(() => {});
      stats.failed++;
      if (++failuresInARow >= MAX_FAILURES_IN_A_ROW) break;
    }
  }
  return stats;
}
