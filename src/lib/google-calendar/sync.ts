import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { meeting, user } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import { loggable } from "@/lib/log";
import { inviteesOf, seriesOf } from "@/lib/meetings/scheduling";
import { meetingPath } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

import { calendarApi, GoogleCalendarError } from "./api";
import { calendarAccess, forgetCalendarTokens } from "./connection";
import {
  desiredEvents,
  eventDescription,
  guestsOf,
  type DesiredEvent,
} from "./events";
import { reconcile } from "./reconcile";
import type { CalendarOutcome, GoogleEventIds } from "./shared";

/** A synced meeting with everything its events are made from; null if not synced. */
async function loadMeeting(meetingId: string) {
  const [found] = await db()
    .select({
      meeting,
      hostName: user.name,
      hostEmail: user.email,
      hostLocale: user.locale,
    })
    .from(meeting)
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(eq(meeting.id, meetingId))
    .limit(1);
  if (!found?.meeting.googleEvents) return null;
  const [series, invitees] = await Promise.all([
    seriesOf(meetingId),
    inviteesOf(meetingId),
  ]);
  return { ...found, ids: found.meeting.googleEvents, series, invitees };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadMeeting>>>;

/** The events the meeting should have, worded in the host's language. */
async function wantedEvents(loaded: Loaded): Promise<DesiredEvent[]> {
  const row = loaded.meeting;
  const locale = hasLocale(routing.locales, loaded.hostLocale)
    ? loaded.hostLocale
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Meeting" });
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const link = `${siteUrl()}${meetingPath(row.code, row.passcode)}`;
  return desiredEvents({
    meeting: {
      id: row.id,
      code: row.code,
      passcode: row.passcode,
      title: row.title ?? t("defaultTitle", { name: loaded.hostName }),
      active: row.status === "active",
      startsAt: row.startsAt,
      durationMin: row.durationMin,
      timeZone: row.timeZone,
    },
    rules: loaded.series.rules,
    guests: guestsOf(loaded.invitees, loaded.hostEmail),
    text: {
      appName,
      link,
      description: eventDescription((line, values) => t(line, values), {
        agenda: row.description,
        hostName: loaded.hostName,
        appName,
        link,
        code: row.code,
        passcode: row.passcode,
      }),
    },
  });
}

/** Saves which events the meeting has, unless sync was turned off meanwhile. */
async function saveIds(meetingId: string, ids: GoogleEventIds) {
  await db()
    .update(meeting)
    .set({ googleEvents: ids })
    .where(and(eq(meeting.id, meetingId), isNotNull(meeting.googleEvents)));
}

function logFailure(error: unknown) {
  if (!(error instanceof GoogleCalendarError)) {
    console.error("Google Calendar sync failed.", loggable(error));
  } else if (error.problem === "disabled") {
    console.error(
      "Google Calendar sync failed: turn on the Google Calendar API in the Google Cloud project.",
    );
  } else {
    console.error(`Google Calendar sync failed: ${error.message}`);
  }
}

/**
 * Makes a synced meeting's events in its host's Google Calendar match FaceOn: creates,
 * updates or removes them (Google emails the invitees), and changes or cancels single
 * occurrences. Runs after the meeting is saved, so a failure never loses a change: it
 * reports "failed" (try again) or "reconnect" (Google no longer accepts the access).
 */
export async function syncGoogleCalendar(
  meetingId: string,
): Promise<CalendarOutcome> {
  const loaded = await loadMeeting(meetingId);
  if (!loaded) return "synced";
  const desired = await wantedEvents(loaded);
  const ids: GoogleEventIds = { ...loaded.ids };
  const hostId = loaded.meeting.hostId;
  const pass = (accessToken: string) =>
    reconcile({
      api: calendarApi(accessToken),
      desired,
      series: loaded.series,
      ids,
    });

  let access = await calendarAccess(hostId);
  if (!access.ok) return access.problem;
  try {
    try {
      await pass(access.accessToken);
    } catch (error) {
      // Google refused a token that looked valid: refresh it once and go again.
      if (!(error instanceof GoogleCalendarError) || error.problem !== "auth") {
        throw error;
      }
      access = await calendarAccess(hostId, { fresh: true });
      if (!access.ok) return access.problem;
      await pass(access.accessToken);
    }
    return "synced";
  } catch (error) {
    if (
      error instanceof GoogleCalendarError &&
      (error.problem === "auth" || error.problem === "scope")
    ) {
      if (access.ok) await forgetCalendarTokens(access.accountId);
      return "reconnect";
    }
    logFailure(error);
    return "failed";
  } finally {
    await saveIds(meetingId, ids);
  }
}
