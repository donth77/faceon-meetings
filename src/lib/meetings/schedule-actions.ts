"use server";

import { createHmac, timingSafeEqual } from "node:crypto";

import { requireSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/server-env";

import { generateMeetingCode, generatePasscode } from "./generate";
import {
  countMeetingsCreatedSince,
  findMeetingByCode,
  updateMeetingSettings,
} from "./queries";
import {
  OccurrenceRef,
  ScheduleInput,
  SeriesScope,
  type ScheduleResult,
} from "./schedule";
import {
  deleteSchedule,
  ScheduleError,
  scheduleMeeting,
  upcomingFor,
  updateSchedule,
  type UpcomingItem,
} from "./scheduling";
import { MeetingSettings } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_ROUTE = "/schedule";

/**
 * A meeting ID and passcode the schedule form can preview before saving, signed so a
 * client can't choose its own. Good for a day.
 */
export type ScheduleDraft = { code: string; passcode: string; token: string };

const sign = (payload: string) => {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret)
    .update(`schedule-draft:${payload}`)
    .digest("base64url");
};

export async function newScheduleDraft(): Promise<ScheduleDraft> {
  const code = generateMeetingCode();
  const passcode = generatePasscode();
  const expires = Date.now() + DAY_MS;
  return {
    code,
    passcode,
    token: `${expires}.${sign(`${code}.${passcode}.${expires}`)}`,
  };
}

function draftIsValid(draft: ScheduleDraft): boolean {
  const [expires = "", mac = ""] = draft.token.split(".");
  if (Number(expires) < Date.now()) return false;
  const expected = Buffer.from(
    sign(`${draft.code}.${draft.passcode}.${expires}`),
  );
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Schedule a meeting: one-off or repeating, with the previewed ID and passcode. */
export async function scheduleMeetingAction(
  input: unknown,
  draft: ScheduleDraft,
): Promise<ScheduleResult> {
  const session = await requireSession(SCHEDULE_ROUTE);
  const parsed = ScheduleInput.safeParse(input);
  if (!parsed.success || !draftIsValid(draft)) {
    return { ok: false, reason: "invalid" };
  }
  const today = await countMeetingsCreatedSince(
    session.user.id,
    new Date(Date.now() - DAY_MS),
  );
  if (today >= serverEnv().MEETINGS_PER_USER_PER_DAY) {
    return { ok: false, reason: "dailyLimit" };
  }
  try {
    const created = await scheduleMeeting({
      hostId: session.user.id,
      code: draft.code,
      passcode: draft.passcode,
      values: parsed.data,
    });
    return { ok: true, code: created.code, passcode: created.passcode };
  } catch (error) {
    if (error instanceof ScheduleError)
      return { ok: false, reason: error.reason };
    throw error;
  }
}

/** The meeting with this ID, if the caller hosts it. */
async function ownMeeting(code: string) {
  const session = await requireSession(SCHEDULE_ROUTE);
  const found = await findMeetingByCode(code);
  if (
    !found ||
    found.meeting.hostId !== session.user.id ||
    found.meeting.type !== "scheduled" ||
    found.meeting.status !== "active"
  ) {
    return null;
  }
  return found.meeting;
}

const occurrenceOf = (value: unknown): Date | null => {
  const parsed = OccurrenceRef.safeParse(value);
  return parsed.success ? new Date(parsed.data) : null;
};

/** Save the edit form: for a series, this meeting, this and following, or all. */
export async function updateScheduleAction(
  code: string,
  input: unknown,
  scope: unknown,
  occurrence: unknown,
): Promise<ScheduleResult> {
  const row = await ownMeeting(code);
  if (!row) return { ok: false, reason: "notFound" };
  const values = ScheduleInput.safeParse(input);
  const which = SeriesScope.safeParse(scope);
  if (!values.success || !which.success)
    return { ok: false, reason: "invalid" };
  try {
    await updateSchedule({
      row,
      values: values.data,
      scope: which.data,
      occurrence: occurrenceOf(occurrence),
    });
  } catch (error) {
    if (error instanceof ScheduleError)
      return { ok: false, reason: error.reason };
    throw error;
  }
  return { ok: true, code: row.code, passcode: row.passcode };
}

/** Delete: for a series, this meeting, this and following, or all. */
export async function deleteScheduleAction(
  code: string,
  scope: unknown,
  occurrence: unknown,
): Promise<boolean> {
  const row = await ownMeeting(code);
  const which = SeriesScope.safeParse(scope);
  if (!row || !which.success) return false;
  await deleteSchedule({
    row,
    scope: which.data,
    occurrence: occurrenceOf(occurrence),
  });
  return true;
}

const DetailsSettings = MeetingSettings.pick({
  waitingRoom: true,
  allowGuests: true,
  muteOnEntry: true,
}).partial();

/** The settings switches on a meeting's page. */
export async function updateScheduledSettingsAction(
  code: string,
  changes: unknown,
): Promise<boolean> {
  const row = await ownMeeting(code);
  const parsed = DetailsSettings.safeParse(changes);
  if (!row || !parsed.success) return false;
  const next = { ...parsed.data };
  // Only hosts can let people in, so turning the waiting room on stops join-before-host.
  await updateMeetingSettings(row.id, row.hostId, {
    ...next,
    ...(next.waitingRoom ? { joinBeforeHost: false } : {}),
  });
  return true;
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
