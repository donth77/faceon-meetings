import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { hasLocale, type Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { meeting } from "@/lib/db/schema";
import { publicEnv } from "@/lib/env";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { generateMeetingCode, generatePasscode } from "@/lib/meetings/generate";
import {
  countMeetingsCreatedSince,
  getOrCreatePersonalRoom,
  insertInstantMeeting,
  readMeeting,
  type Meeting,
} from "@/lib/meetings/queries";
import { startFacts, toRRule } from "@/lib/meetings/recurrence";
import { DAY_MS } from "@/lib/meetings/retention";
import { ScheduleInput, type ScheduleValues } from "@/lib/meetings/schedule";
import {
  deleteSchedule,
  invitationsOf,
  ScheduleError,
  scheduleMeeting,
  seriesOf,
  upcomingFor,
  updateSchedule,
} from "@/lib/meetings/scheduling";
import {
  DEFAULT_SETTINGS,
  type MeetingSettings,
} from "@/lib/meetings/settings";
import { meetingPath } from "@/lib/routes";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";
import { formatWhen, localParts, untilStamp } from "@/lib/time";

import { scheduleOfEvent, type EventSchedule } from "./event";
import type {
  AddonConference,
  AddonHome,
  AddonMeeting,
  ConferenceCreate,
  ConferenceUpdate,
  GoogleAddonEvent,
  MeetingCreate,
} from "./types";

/** The FaceOn account whose add-on a request comes from. */
export type AddonUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

/** Why something can't be done, for the add-on's PERMANENT error. */
export class AddonRefusal extends Error {
  constructor(readonly reason: "dailyLimit") {
    super(reason);
  }
}

/** The meeting isn't one this person made from Google Calendar (or it's gone). */
export class AddonNotFound extends Error {}

/** A supported language for text, from Google's locale ("en-GB" → "en"). */
export function addonLocale(locale: string | undefined): Locale {
  const wanted = (locale ?? "").replace("_", "-");
  if (hasLocale(routing.locales, wanted)) return wanted;
  const base = wanted.split("-")[0];
  return hasLocale(routing.locales, base) ? base : routing.defaultLocale;
}

const joinUrl = (code: string, passcode: string | null) =>
  `${siteUrl()}${meetingPath(code, passcode)}`;

function conferenceOf(
  row: Pick<Meeting, "code" | "passcode">,
): AddonConference {
  return {
    code: row.code,
    meetingId: formatMeetingCode(row.code),
    joinUrl: joinUrl(row.code, row.passcode),
    passcode: row.passcode,
  };
}

async function defaultTitle(hostName: string, locale: Locale): Promise<string> {
  const t = await getTranslations({ locale, namespace: "Meeting" });
  return t("defaultTitle", { name: hostName });
}

/** The invitation, as FaceOn's Copy invitation writes it, in the person's language. */
async function meetingFor(
  row: Pick<Meeting, "code" | "passcode" | "title">,
  host: AddonUser,
  locale: Locale,
): Promise<AddonMeeting> {
  const t = await getTranslations({ locale, namespace: "Meeting" });
  const conference = conferenceOf(row);
  const title = row.title || (await defaultTitle(host.name, locale));
  const invitation = [
    t("invitation.intro", {
      host: host.name,
      appName: publicEnv.NEXT_PUBLIC_APP_NAME,
    }),
    "",
    title,
    t("invitation.join", { link: conference.joinUrl }),
    "",
    t("invitation.meetingId", { code: conference.meetingId }),
    ...(row.passcode
      ? [t("invitation.passcode", { passcode: row.passcode })]
      : []),
  ].join("\n");
  return { ...conference, title, invitation };
}

/** Meetings made through the add-on count towards the host's daily limit, as anywhere. */
async function withinDailyLimit(hostId: string): Promise<void> {
  const today = await countMeetingsCreatedSince(
    hostId,
    new Date(Date.now() - DAY_MS),
  );
  if (today >= serverEnv().MEETINGS_PER_USER_PER_DAY) {
    throw new AddonRefusal("dailyLimit");
  }
}

/** The active meeting this host made for a Calendar event, if there is one. */
async function meetingForEvent(
  hostId: string,
  eventId: string,
): Promise<Meeting | null> {
  const [row] = await db()
    .select()
    .from(meeting)
    .where(
      and(
        eq(meeting.hostId, hostId),
        eq(meeting.origin, "google_addon"),
        eq(meeting.status, "active"),
        sql`${meeting.googleAddonEvent}->>'eventId' = ${eventId}`,
      ),
    )
    .limit(1);
  return row ? readMeeting(row) : null;
}

/** The host's active meeting from Google Calendar with this ID. */
async function ownCalendarMeeting(
  hostId: string,
  code: string,
): Promise<Meeting> {
  const [row] = await db()
    .select()
    .from(meeting)
    .where(
      and(
        eq(meeting.code, code),
        eq(meeting.hostId, hostId),
        eq(meeting.origin, "google_addon"),
        eq(meeting.status, "active"),
      ),
    )
    .limit(1);
  if (!row) throw new AddonNotFound();
  return readMeeting(row);
}

/** What a schedule keeps from a meeting while Google Calendar changes its time. */
type Kept = {
  description: string;
  passcode: boolean;
  settings: MeetingSettings;
  invitees: string[];
  cohosts: string[];
};

const NEW_MEETING: Kept = {
  description: "",
  passcode: true,
  settings: DEFAULT_SETTINGS.scheduled,
  invitees: [],
  cohosts: [],
};

function valuesFor(
  timed: NonNullable<EventSchedule["timed"]>,
  title: string,
  kept: Kept,
): ScheduleValues | null {
  const parsed = ScheduleInput.safeParse({
    title,
    description: kept.description,
    start: timed.start,
    timeZone: timed.timeZone,
    durationMin: timed.durationMin,
    recurrence: timed.recurrence,
    passcode: kept.passcode,
    waitingRoom: kept.settings.waitingRoom,
    allowGuests: kept.settings.allowGuests,
    joinBeforeHost: kept.settings.joinBeforeHost,
    muteOnEntry: kept.settings.muteOnEntry,
    autoNotes: kept.settings.autoNotes,
    shareNotes: kept.settings.shareNotes,
    invitees: kept.invitees,
    cohosts: kept.cohosts,
    googleCalendar: false,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * "FaceOn meeting" chosen for a Calendar event. A timed event, or a series FaceOn can
 * follow, becomes an ordinary scheduled meeting; otherwise (a new event Google hasn't
 * saved yet, or a repeat FaceOn can't say) one meeting ID with no fixed time, which gets
 * its time when the event is saved. Choosing it again for the same event gives the same
 * meeting. Google Calendar invites the people, so FaceOn keeps none.
 */
export async function createConference(
  host: AddonUser,
  input: ConferenceCreate,
): Promise<AddonConference> {
  const existing = await meetingForEvent(host.id, input.eventId);
  if (existing) return conferenceOf(existing);
  await withinDailyLimit(host.id);
  const event: GoogleAddonEvent = {
    eventId: input.eventId,
    calendarId: input.calendarId,
  };
  const schedule = input.event ? scheduleOfEvent(input.event) : null;
  const locale = addonLocale(input.locale);
  const title = schedule?.title ?? (await defaultTitle(host.name, locale));
  const values = schedule?.timed
    ? valuesFor(schedule.timed, title, NEW_MEETING)
    : null;
  if (values) {
    // Meeting IDs are random, so a collision is rare: try a new one on each.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return conferenceOf(
          await scheduleMeeting({
            hostId: host.id,
            code: generateMeetingCode(),
            passcode: generatePasscode(),
            values,
            googleCalendar: false,
            origin: "google_addon",
            googleAddonEvent: event,
          }),
        );
      } catch (error) {
        if (!(error instanceof ScheduleError)) throw error;
      }
    }
    throw new Error("Could not find a free meeting ID.");
  }
  return conferenceOf(
    await insertInstantMeeting(host.id, {
      title: schedule?.title ?? null,
      origin: "google_addon",
      googleAddonEvent: event,
    }),
  );
}

/** The meeting's current schedule, said the way a new one would be, to spot no-ops. */
async function sameSchedule(
  row: Meeting,
  values: ScheduleValues,
): Promise<boolean> {
  if (row.type !== "scheduled" || !row.startsAt || !row.timeZone) return false;
  const local = localParts(row.startsAt, row.timeZone);
  if (
    row.title !== values.title ||
    `${local.date}T${local.time}` !== values.start ||
    row.timeZone !== values.timeZone ||
    row.durationMin !== values.durationMin
  ) {
    return false;
  }
  const series = await seriesOf(row.id);
  const rule = values.recurrence;
  if (!rule) return series.rules.length === 0;
  const [only] = series.rules;
  if (series.rules.length !== 1 || !only) return false;
  const rrule = toRRule(
    rule,
    startFacts(values.start.slice(0, 10)),
    rule.end.kind === "on" ? untilStamp(rule.end.date, values.timeZone) : null,
  );
  return only.rrule === rrule;
}

/**
 * The event changed in Google Calendar: its title, time and repeat now, or one meeting
 * of its series moved or was removed. FaceOn's own settings (passcode, waiting room, AI
 * notes, co-hosts) stay as the host set them. A change FaceOn already has does nothing,
 * so a series keeps its one-off changes when Google re-sends an event.
 */
export async function updateConference(
  host: AddonUser,
  code: string,
  update: ConferenceUpdate,
): Promise<void> {
  const row = await ownCalendarMeeting(host.id, code);

  if ("occurrence" in update) {
    const { originalStart, start, end, cancelled } = update.occurrence;
    const series = row.type === "scheduled" ? await seriesOf(row.id) : null;
    if (!series || series.rules.length === 0 || !row.timeZone) return;
    const occurrence = new Date(originalStart);
    if (cancelled) {
      await deleteSchedule({ row, scope: "this", occurrence });
      return;
    }
    if (!start || !end) return;
    const timing = scheduleOfEvent({ start, end, timeZone: row.timeZone });
    if (!timing.timed) return;
    const invitations = await invitationsOf(row.id);
    const values = valuesFor(
      { ...timing.timed, recurrence: null },
      row.title ?? "",
      keptFrom(row, invitations),
    );
    if (values) {
      await updateSchedule({
        row,
        values,
        scope: "this",
        occurrence,
        googleCalendar: false,
      });
    }
    return;
  }

  const schedule = scheduleOfEvent(update.event, row.timeZone ?? "UTC");
  const title = schedule.title ?? row.title ?? "";
  const invitations = await invitationsOf(row.id);
  const values = schedule.timed
    ? valuesFor(schedule.timed, title, keptFrom(row, invitations))
    : null;
  if (!values) {
    // FaceOn can't follow the new time or repeat: it keeps its own, with the new title.
    if (title && title !== row.title) {
      await db().update(meeting).set({ title }).where(eq(meeting.id, row.id));
    }
    return;
  }
  if (await sameSchedule(row, values)) return;
  if (row.type === "instant") {
    // A time at last (the event was saved): it becomes an ordinary scheduled meeting.
    await db()
      .update(meeting)
      .set({ type: "scheduled" })
      .where(eq(meeting.id, row.id));
  }
  await updateSchedule({
    row: { ...row, type: "scheduled" },
    values,
    scope: "all",
    occurrence: null,
    googleCalendar: false,
  });
}

function keptFrom(
  row: Meeting,
  invitations: { invitees: string[]; cohosts: string[] },
): Kept {
  return {
    description: row.description ?? "",
    passcode: row.passcode !== null,
    settings: row.settings,
    invitees: invitations.invitees,
    cohosts: invitations.cohosts,
  };
}

/** The event was deleted: the meeting is cancelled. Previous keeps what already happened. */
export async function cancelConference(
  host: AddonUser,
  code: string,
): Promise<void> {
  const row = await ownCalendarMeeting(host.id, code);
  await deleteSchedule({ row, scope: "all", occurrence: null });
}

/** Gmail's compose window, or the sidebar's Start a meeting: a new meeting or the personal room. */
export async function addonMeeting(
  host: AddonUser,
  input: MeetingCreate,
): Promise<AddonMeeting> {
  const locale = addonLocale(input.locale);
  if (input.kind === "personalRoom") {
    return meetingFor(await getOrCreatePersonalRoom(host.id), host, locale);
  }
  await withinDailyLimit(host.id);
  return meetingFor(
    await insertInstantMeeting(host.id, { title: input.title || null }),
    host,
    locale,
  );
}

/** The sidebar: the personal room and the next week's meetings, in the person's language and zone. */
export async function addonHome(
  host: AddonUser,
  options: { locale?: string; timeZone?: string },
): Promise<AddonHome> {
  const locale = addonLocale(options.locale);
  const timeZone =
    options.timeZone && isZone(options.timeZone) ? options.timeZone : "UTC";
  const now = new Date();
  const [room, upcoming] = await Promise.all([
    getOrCreatePersonalRoom(host.id),
    upcomingFor({
      userId: host.id,
      verifiedEmail: host.emailVerified ? host.email : null,
      from: now,
      to: new Date(now.getTime() + 7 * DAY_MS),
    }),
  ]);
  return {
    name: host.name,
    personalRoom: await meetingFor(room, host, locale),
    upcoming: await Promise.all(
      upcoming.slice(0, 3).map(async (item) => ({
        code: item.code,
        title: item.title || (await defaultTitle(item.hostName, locale)),
        when: formatWhen(item.start, item.end, timeZone, locale),
        joinUrl: joinUrl(item.code, item.passcode),
      })),
    ),
  };
}

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
