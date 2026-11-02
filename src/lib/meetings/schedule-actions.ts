"use server";

import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { calendarConnection } from "@/lib/google-calendar/connection";
import type { CalendarOutcome } from "@/lib/google-calendar/shared";
import { syncGoogleCalendar } from "@/lib/google-calendar/sync";
import { loggable } from "@/lib/log";
import { serverEnv } from "@/lib/server-env";

import { Passcode } from "./codes";
import { notesAllowedFor } from "./notes";
import {
  countMeetingsCreatedSince,
  findMeetingByCode,
  saveScheduleDefaults,
  setMeetingPasscode,
  storedScheduleDefaults,
  updateMeetingSettings,
} from "./queries";
import { DAY_MS } from "./retention";
import {
  cohostsAllowed,
  OccurrenceRef,
  ScheduleDraft,
  ScheduleInput,
  SeriesScope,
  type DeleteResult,
  type ScheduleResult,
} from "./schedule";
import { nextScheduleDefaults } from "./schedule-defaults";
import { draftIsValid } from "./schedule-draft";
import {
  deleteSchedule,
  ScheduleError,
  scheduleMeeting,
  upcomingFor,
  updateSchedule,
  type UpcomingItem,
} from "./scheduling";
import { MeetingSettings } from "./settings";

const SCHEDULE_ROUTE = "/schedule";

/** Actions are public endpoints: every argument is checked, whatever its type says. */
const MeetingCode = z.string().max(32);

/**
 * The host's Google Calendar is connected, or only needs a reconnect, which the outcome
 * then asks for.
 */
async function calendarOffered(host: {
  id: string;
  email: string;
}): Promise<boolean> {
  const { status } = await calendarConnection(host);
  return status === "connected" || status === "reconnect";
}

/** Whether a meeting may go on the host's Google Calendar: they asked, and it's connected. */
async function wantsGoogleCalendar(
  asked: boolean,
  host: { id: string; email: string },
): Promise<boolean> {
  return asked && (await calendarOffered(host));
}

/**
 * The next new meeting starts from this one's options, never its details. Remembering
 * is a convenience: if it fails, the meeting is still scheduled.
 */
async function rememberOptions(
  host: { id: string; email: string },
  used: Parameters<typeof nextScheduleDefaults>[1],
): Promise<void> {
  try {
    const [stored, aiNotes, calendar] = await Promise.all([
      storedScheduleDefaults(host.id),
      notesAllowedFor(host.id),
      calendarOffered(host),
    ]);
    await saveScheduleDefaults(
      host.id,
      nextScheduleDefaults(stored, used, { aiNotes, calendar }),
    );
  } catch (error) {
    console.error("Couldn't remember the scheduling options", loggable(error));
  }
}

/** Schedule a meeting: one-off or repeating, with the previewed ID and passcode. */
export async function scheduleMeetingAction(
  input: unknown,
  draft: unknown,
): Promise<ScheduleResult> {
  const session = await requireSession(SCHEDULE_ROUTE);
  const parsed = ScheduleInput.safeParse(input);
  const signed = ScheduleDraft.safeParse(draft);
  if (
    !parsed.success ||
    !signed.success ||
    !draftIsValid(signed.data) ||
    !cohostsAllowed(parsed.data.cohosts, session.user.email)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const today = await countMeetingsCreatedSince(
    session.user.id,
    new Date(Date.now() - DAY_MS),
  );
  if (today >= serverEnv().MEETINGS_PER_USER_PER_DAY) {
    return { ok: false, reason: "dailyLimit" };
  }
  let created;
  try {
    created = await scheduleMeeting({
      hostId: session.user.id,
      code: signed.data.code,
      // The host's own passcode, or the one the form previewed.
      passcode: parsed.data.passcodeText ?? signed.data.passcode,
      values: parsed.data,
      googleCalendar: await wantsGoogleCalendar(
        parsed.data.googleCalendar,
        session.user,
      ),
    });
  } catch (error) {
    if (error instanceof ScheduleError)
      return { ok: false, reason: error.reason };
    throw error;
  }
  await rememberOptions(session.user, parsed.data);
  // The meeting is saved; Google Calendar follows, and can be retried if it fails.
  return {
    ok: true,
    code: created.code,
    passcode: created.passcode,
    calendar: created.googleEvents
      ? await syncGoogleCalendar(created.id)
      : undefined,
  };
}

/** The scheduled meeting with this ID, if the caller hosts it (and it's not deleted). */
async function ownMeeting(code: unknown, { deleted = false } = {}) {
  const session = await requireSession(SCHEDULE_ROUTE);
  const parsed = MeetingCode.safeParse(code);
  const found = parsed.success ? await findMeetingByCode(parsed.data) : null;
  if (
    !found ||
    found.meeting.hostId !== session.user.id ||
    found.meeting.type !== "scheduled" ||
    (found.meeting.status !== "active" && !deleted)
  ) {
    return null;
  }
  return { row: found.meeting, host: session.user };
}

const occurrenceOf = (value: unknown): Date | null => {
  const parsed = OccurrenceRef.safeParse(value);
  return parsed.success ? new Date(parsed.data) : null;
};

/** Save the edit form: for a series, this meeting, this and following, or all. */
export async function updateScheduleAction(
  code: unknown,
  input: unknown,
  scope: unknown,
  occurrence: unknown,
): Promise<ScheduleResult> {
  const own = await ownMeeting(code);
  // A meeting made in Google Calendar changes its time there (the add-on follows).
  if (!own || own.row.origin === "google_addon") {
    return { ok: false, reason: "notFound" };
  }
  const { row, host } = own;
  const values = ScheduleInput.safeParse(input);
  const which = SeriesScope.safeParse(scope);
  if (
    !values.success ||
    !which.success ||
    !cohostsAllowed(values.data.cohosts, host.email)
  ) {
    return { ok: false, reason: "invalid" };
  }
  const startSync = await wantsGoogleCalendar(
    values.data.googleCalendar && row.googleEvents === null,
    host,
  );
  try {
    await updateSchedule({
      row,
      values: values.data,
      scope: which.data,
      occurrence: occurrenceOf(occurrence),
      googleCalendar: startSync,
    });
  } catch (error) {
    if (error instanceof ScheduleError)
      return { ok: false, reason: error.reason };
    throw error;
  }
  return {
    ok: true,
    code: row.code,
    passcode: row.passcode,
    calendar:
      row.googleEvents !== null || startSync
        ? await syncGoogleCalendar(row.id)
        : undefined,
  };
}

/** Delete: for a series, this meeting, this and following, or all. */
export async function deleteScheduleAction(
  code: unknown,
  scope: unknown,
  occurrence: unknown,
): Promise<DeleteResult> {
  const own = await ownMeeting(code);
  const which = SeriesScope.safeParse(scope);
  if (!own || own.row.origin === "google_addon" || !which.success) {
    return { ok: false };
  }
  await deleteSchedule({
    row: own.row,
    scope: which.data,
    occurrence: occurrenceOf(occurrence),
  });
  return {
    ok: true,
    calendar:
      own.row.googleEvents !== null
        ? await syncGoogleCalendar(own.row.id)
        : undefined,
  };
}

/**
 * Try Google Calendar again after it failed, or after reconnecting: brings a synced
 * meeting's events in line with it, deleted meetings included.
 */
export async function syncGoogleCalendarAction(
  code: unknown,
): Promise<CalendarOutcome | null> {
  const own = await ownMeeting(code, { deleted: true });
  if (!own || own.row.googleEvents === null) return null;
  return syncGoogleCalendar(own.row.id);
}

const DetailsSettings = MeetingSettings.pick({
  waitingRoom: true,
  allowGuests: true,
  muteOnEntry: true,
  autoNotes: true,
  shareNotes: true,
}).partial();

/** The settings switches on a meeting's page. */
export async function updateScheduledSettingsAction(
  code: unknown,
  changes: unknown,
): Promise<boolean> {
  const own = await ownMeeting(code);
  const parsed = DetailsSettings.safeParse(changes);
  if (!own || !parsed.success) return false;
  const next = { ...parsed.data };
  // Only hosts can let people in, so turning the waiting room on stops join-before-host.
  await updateMeetingSettings(own.row.id, own.row.hostId, {
    ...next,
    ...(next.waitingRoom ? { joinBeforeHost: false } : {}),
  });
  return true;
}

/**
 * A meeting's page → Change passcode: its host sets a new one (their own, or Generate's).
 * The old one, and links with it, stop working; anyone already in the meeting stays.
 * Google Calendar's events follow, for a synced meeting.
 */
export async function changePasscodeAction(
  code: unknown,
  passcode: unknown,
): Promise<
  { ok: true; passcode: string; calendar?: CalendarOutcome } | { ok: false }
> {
  const own = await ownMeeting(code);
  const parsed = Passcode.safeParse(passcode);
  if (!own || !parsed.success || own.row.passcode === null)
    return { ok: false };
  await setMeetingPasscode(own.row.id, own.row.hostId, parsed.data);
  return {
    ok: true,
    passcode: parsed.data,
    calendar:
      own.row.googleEvents === null
        ? undefined
        : await syncGoogleCalendar(own.row.id),
  };
}

/** Upcoming rows as the browser gets them: times in ISO 8601. */
export type OccurrenceRow = Omit<
  UpcomingItem,
  "start" | "end" | "originalStart"
> & { start: string; end: string; originalStart: string };

/**
 * The calendar's meetings between two moments (at most about two months at a time): the
 * ones the caller hosts or is invited to.
 */
export async function occurrencesAction(
  from: unknown,
  to: unknown,
): Promise<OccurrenceRow[]> {
  const session = await requireSession("/upcoming");
  const start = OccurrenceRef.safeParse(from);
  const end = OccurrenceRef.safeParse(to);
  if (!start.success || !end.success) return [];
  const fromDate = new Date(start.data);
  const toDate = new Date(end.data);
  if (
    toDate <= fromDate ||
    toDate.getTime() - fromDate.getTime() > 62 * DAY_MS
  ) {
    return [];
  }
  const items = await upcomingFor({
    userId: session.user.id,
    verifiedEmail: session.user.emailVerified ? session.user.email : null,
    from: fromDate,
    to: toDate,
  });
  return items.slice(0, 500).map((item) => ({
    ...item,
    start: item.start.toISOString(),
    end: item.end.toISOString(),
    originalStart: item.originalStart.toISOString(),
  }));
}
