import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailDay } from "@/lib/db/schema";
import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";
import { z } from "@/lib/zod";

import {
  dayBefore,
  emailsByDay,
  resendInstant,
  utcDay,
  utcMonth,
  type ListedEmail,
} from "./meters";
import { isFresh, lastReading, saveReading } from "./readings";

const EMAILS = "https://api.resend.com/emails";
const PAGE_SIZE = 100;
/** 6,000 emails: well past a free month's 3,000, so a listing always ends. */
const MAX_PAGES = 60;
/** Between pages, well inside Resend's rate limit. */
const SPACING_MS = 200;
/** Emails made this long before the month can be scheduled into it (reminders go ahead). */
const SCHEDULED_AHEAD_MS = 3 * 24 * 60 * 60_000;

const Page = z.object({
  has_more: z.boolean(),
  data: z.array(
    z.object({
      id: z.string().min(1),
      created_at: z.string(),
      scheduled_at: z.string().nullish(),
      last_event: z.string().nullish(),
      to: z.array(z.string()).nullish(),
      cc: z.array(z.string()).nullish(),
      bcc: z.array(z.string()).nullish(),
    }),
  ),
});

/**
 * Whether Resend's list of the account's emails could be read: "restricted" when the
 * key can only send (Resend's sending-access keys can't list), "unavailable" when Resend
 * didn't answer as expected, "unconfigured" without a key.
 */
export type Listing = "ok" | "restricted" | "unavailable" | "unconfigured";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The account's emails made since `since`, newest first as Resend lists them, page by
 * page until it gets there. Only when, scheduled when, cancelled and how many
 * recipients are kept: never who they went to.
 */
export async function listResendEmails(
  key: string,
  since: Date,
): Promise<ListedEmail[] | Exclude<Listing, "ok" | "unconfigured">> {
  const emails: ListedEmail[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) await pause(SPACING_MS);
    const url = new URL(EMAILS);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!response) return "unavailable";
    if (response.status === 401 || response.status === 403) return "restricted";
    if (!response.ok) return "unavailable";
    const parsed = Page.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return "unavailable";
    for (const item of parsed.data.data) {
      const createdAt = resendInstant(item.created_at);
      if (!createdAt) continue;
      emails.push({
        createdAt,
        scheduledAt: resendInstant(item.scheduled_at),
        cancelled: item.last_event === "canceled",
        recipients:
          (item.to?.length ?? 0) +
          (item.cc?.length ?? 0) +
          (item.bcc?.length ?? 0),
      });
    }
    const last = parsed.data.data.at(-1);
    const oldest = resendInstant(last?.created_at);
    if (!parsed.data.has_more || !last || !oldest || oldest < since) break;
    after = last.id;
  }
  return emails;
}

/** Resend's listing as last tried, kept with the time it was tried (readings.ts). */
const Tried = z.object({
  listing: z.enum(["ok", "restricted", "unavailable"]),
});

/**
 * Brings Resend's own counts up to date from its list of the account's emails, so the
 * usage meter sees every email: those sent before it existed, scheduled reminders on the
 * day they go, and other apps on the same Resend account (its free limits are
 * account-wide). Each day's count goes on that day's row, and the month's (UTC) on
 * today's, noted as from the list. Resend is asked at most every five minutes (the
 * daily check asks regardless, with `force`), and the outcome is kept, so every server
 * knows whether the key can list. RESEND_USAGE_API_KEY is used where it's set, since a
 * key that can only send can't list. A failure is reported when the outcome changes,
 * except a sending key that can't list.
 */
export async function refreshResendCounts(
  now = new Date(),
  force = false,
): Promise<Listing> {
  const env = serverEnv();
  const key = env.RESEND_USAGE_API_KEY ?? env.RESEND_API_KEY;
  if (!key) return "unconfigured";
  const last = await lastReading("resend");
  const tried = Tried.safeParse(last?.data).data?.listing ?? null;
  if (!force && tried && isFresh(last, now)) return tried;

  const month = utcMonth(now);
  const listed = await listResendEmails(
    key,
    new Date(month.start.getTime() - SCHEDULED_AHEAD_MS),
  );
  if (!Array.isArray(listed)) {
    // A sending key that can't list is how most copies run, and Settings → Admin says
    // what to add; a usage key that can't, or Resend not answering, is worth a look.
    const expected = listed === "restricted" && !env.RESEND_USAGE_API_KEY;
    if (tried !== listed && !expected) {
      reportError(
        "Couldn't list Resend's emails for the usage meter.",
        undefined,
        {
          state: listed,
          key: env.RESEND_USAGE_API_KEY
            ? "RESEND_USAGE_API_KEY"
            : "RESEND_API_KEY",
        },
      );
    }
    await saveReading("resend", { listing: listed }, now);
    return listed;
  }

  const byDay = emailsByDay(listed);
  const today = utcDay(now);
  const first = utcDay(month.start);
  const end = utcDay(month.end);
  const yesterday = dayBefore(today);
  let monthTotal = 0;
  const rows: { day: string; resendDaily: number }[] = [];
  for (const [day, count] of byDay) {
    if (day >= first && day < end) monthTotal += count;
    if (day >= yesterday && day < end) rows.push({ day, resendDaily: count });
  }
  // Counts only grow: a send's headers may know of more (emails Resend received count
  // too), so neither source lowers what the other found.
  if (rows.length > 0) {
    await db()
      .insert(emailDay)
      .values(rows)
      .onConflictDoUpdate({
        target: emailDay.day,
        set: {
          resendDaily: sql`greatest(coalesce(${emailDay.resendDaily}, 0), excluded.resend_daily)`,
        },
      });
  }
  await db()
    .insert(emailDay)
    .values({
      day: today,
      resendMonthly: monthTotal,
      resendAt: now,
      resendVia: "list",
    })
    .onConflictDoUpdate({
      target: emailDay.day,
      set: {
        resendMonthly: sql`greatest(coalesce(${emailDay.resendMonthly}, 0), excluded.resend_monthly)`,
        resendAt: now,
        resendVia: "list",
      },
    });
  await saveReading("resend", { listing: "ok" }, now);
  return "ok";
}

/** Refreshes Resend's counts, never failing what asked: an error counts as unavailable. */
export async function freshResendCounts(
  now = new Date(),
  force = false,
): Promise<Listing> {
  try {
    return await refreshResendCounts(now, force);
  } catch (error) {
    reportError("Couldn't refresh Resend's counts", error);
    return "unavailable";
  }
}
