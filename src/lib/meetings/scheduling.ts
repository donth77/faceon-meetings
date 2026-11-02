import { googleEventUrl } from "@/lib/addon/google/event-link";

import "server-only";

import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";

import { avatarUrl } from "@/lib/avatars/seed";
import { db, type Executor, type Transaction } from "@/lib/db";
import {
  meeting,
  meetingException,
  meetingInvitee,
  meetingRule,
  meetingSession,
  participantSession,
  user,
} from "@/lib/db/schema";
import { localParts } from "@/lib/time";

import { generatePasscode } from "./generate";
import {
  isTimeZone,
  lastStartOf,
  occurrencesBetween,
  untilUtc,
  zonedInstant,
  type ExceptionRow,
  type Occurrence,
  type RuleRow,
} from "./occurrences";
import { isUniqueViolation, readMeeting, type Meeting } from "./queries";
import { startFacts, toRRule, type Recurrence } from "./recurrence";
import type { ScheduleValues, SeriesScope } from "./schedule";
import { DEFAULT_SETTINGS, MeetingSettings } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Scheduled meetings stay reachable this long after their last meeting ends. */
const KEEP_AFTER_MS = 30 * DAY_MS;
/** A series that never ends lasts this long past its last session, like Zoom's. */
const OPEN_SERIES_MS = 365 * DAY_MS;

/** A repeat rule as stored: each has an ID (Calendar sync keeps an event per rule). */
export type SeriesRule = RuleRow & { id: string };
export type Series = { rules: SeriesRule[]; exceptions: ExceptionRow[] };

export class ScheduleError extends Error {
  constructor(readonly reason: "invalid" | "notFound") {
    super(reason);
  }
}

/** The repeat rule for a series starting at a local time, or null for a one-off. */
function ruleFor(
  values: ScheduleValues,
  firstStart: Date,
): Omit<RuleRow, "lastStart"> | null {
  if (!values.recurrence) return null;
  const recurrence: Recurrence = values.recurrence;
  const until =
    recurrence.end.kind === "on"
      ? untilUtc(recurrence.end.date, values.timeZone)
      : null;
  return {
    rrule: toRRule(recurrence, startFacts(values.start), until),
    firstStart,
    durationMin: values.durationMin,
    timeZone: values.timeZone,
  };
}

/** When a scheduled meeting's link stops working: a month after its last meeting. */
function expiryFor(start: Date, durationMin: number, rules: RuleRow[]): Date {
  if (rules.length === 0) {
    return new Date(start.getTime() + durationMin * 60_000 + KEEP_AFTER_MS);
  }
  const lasts = rules.map((rule) => lastStartOf(rule));
  if (lasts.some((last) => last === null)) {
    return new Date(Date.now() + OPEN_SERIES_MS);
  }
  const last = Math.max(...lasts.map((d) => d?.getTime() ?? 0));
  return new Date(last + durationMin * 60_000 + KEEP_AFTER_MS);
}

function settingsFrom(values: ScheduleValues): MeetingSettings {
  return MeetingSettings.parse({
    ...DEFAULT_SETTINGS.scheduled,
    waitingRoom: values.waitingRoom,
    allowGuests: values.allowGuests,
    // Only hosts can let people in, so join-before-host needs the waiting room off.
    joinBeforeHost: values.joinBeforeHost && !values.waitingRoom,
    muteOnEntry: values.muteOnEntry,
    autoNotes: values.autoNotes,
    shareNotes: values.shareNotes,
  });
}

/**
 * The invitation rows for a meeting: invitees, and named co-hosts (invited too). An
 * address on both lists is a co-host.
 */
function invitationRows(
  meetingId: string,
  invitees: readonly string[],
  cohosts: readonly string[],
) {
  const named = new Set(cohosts);
  return [
    ...[...new Set(invitees)]
      .filter((email) => !named.has(email))
      .map((email) => ({ meetingId, email, cohost: false })),
    ...[...named].map((email) => ({ meetingId, email, cohost: true })),
  ];
}

function checked(values: ScheduleValues): Date {
  if (!isTimeZone(values.timeZone)) throw new ScheduleError("invalid");
  return zonedInstant(values.start, values.timeZone);
}

/**
 * Creates a scheduled meeting, one-off or repeating, with the code and passcode the
 * form previewed. If that code was taken meanwhile, it's refused as invalid.
 * `googleCalendar` marks it for Calendar sync, which makes its events afterwards.
 */
export async function scheduleMeeting(input: {
  hostId: string;
  code: string;
  passcode: string;
  values: ScheduleValues;
  googleCalendar: boolean;
  /** Made in Google Calendar by the Workspace add-on, for this event. */
  origin?: Meeting["origin"];
  googleAddonEvent?: Meeting["googleAddonEvent"];
}): Promise<Meeting> {
  const { values } = input;
  const start = checked(values);
  const rule = ruleFor(values, start);
  const rules: RuleRow[] = rule ? [{ ...rule, lastStart: null }] : [];

  return db().transaction(async (tx) => {
    let row;
    try {
      [row] = await tx
        .insert(meeting)
        .values({
          code: input.code,
          hostId: input.hostId,
          type: "scheduled",
          title: values.title,
          description: values.description || null,
          passcode: values.passcode ? input.passcode : null,
          settings: settingsFrom(values),
          startsAt: start,
          durationMin: values.durationMin,
          timeZone: values.timeZone,
          expiresAt: expiryFor(start, values.durationMin, rules),
          googleEvents: input.googleCalendar ? {} : null,
          origin: input.origin ?? "faceon",
          googleAddonEvent: input.googleAddonEvent ?? null,
        })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) throw new ScheduleError("invalid");
      throw error;
    }
    if (!row) throw new Error("Could not schedule the meeting.");
    if (rule)
      await tx.insert(meetingRule).values({ meetingId: row.id, ...rule });
    const invited = invitationRows(row.id, values.invitees, values.cohosts);
    if (invited.length > 0) {
      await tx.insert(meetingInvitee).values(invited).onConflictDoNothing();
    }
    return readMeeting(row);
  });
}

/** A meeting's repeat rules and one-off changes; inside a transaction, through it. */
export async function seriesOf(
  meetingId: string,
  executor: Executor = db(),
): Promise<Series> {
  const [rules, exceptions] = await Promise.all([
    executor
      .select()
      .from(meetingRule)
      .where(eq(meetingRule.meetingId, meetingId))
      .orderBy(asc(meetingRule.firstStart)),
    executor
      .select()
      .from(meetingException)
      .where(eq(meetingException.meetingId, meetingId)),
  ]);
  return { rules, exceptions };
}

/** Everyone invited to a meeting, named co-hosts included, in the order they were added. */
export async function inviteesOf(meetingId: string): Promise<string[]> {
  return (await invitationsOf(meetingId)).everyone;
}

/** A meeting's invitees and its named co-hosts, apart, and everyone together. */
export async function invitationsOf(meetingId: string): Promise<{
  invitees: string[];
  cohosts: string[];
  everyone: string[];
}> {
  const rows = await db()
    .select({ email: meetingInvitee.email, cohost: meetingInvitee.cohost })
    .from(meetingInvitee)
    .where(eq(meetingInvitee.meetingId, meetingId))
    .orderBy(asc(meetingInvitee.addedAt));
  return {
    invitees: rows.filter((row) => !row.cohost).map((row) => row.email),
    cohosts: rows.filter((row) => row.cohost).map((row) => row.email),
    everyone: rows.map((row) => row.email),
  };
}

/** A scheduled meeting's occurrences between two moments (one for a one-off). */
export function occurrencesOf(
  row: Meeting,
  series: Series,
  from: Date,
  to: Date,
): Occurrence[] {
  if (series.rules.length > 0) {
    return occurrencesBetween({ ...series, from, to });
  }
  if (!row.startsAt || !row.durationMin) return [];
  const start = row.startsAt;
  const end = new Date(start.getTime() + row.durationMin * 60_000);
  if (end <= from || start >= to) return [];
  return [{ originalStart: start, start, end, title: null, moved: false }];
}

async function replaceInvitations(
  tx: Transaction,
  meetingId: string,
  values: Pick<ScheduleValues, "invitees" | "cohosts">,
) {
  await tx
    .delete(meetingInvitee)
    .where(eq(meetingInvitee.meetingId, meetingId));
  const invited = invitationRows(meetingId, values.invitees, values.cohosts);
  if (invited.length > 0) {
    await tx.insert(meetingInvitee).values(invited).onConflictDoNothing();
  }
}

/**
 * Saves the schedule form over a meeting. For a series, `scope` says which meetings:
 * just one (an exception), it and the ones after it (a new rule from there), or all.
 * Settings, invitees and the passcode always apply to the whole meeting, and so does
 * `googleCalendar`, which starts Calendar sync (it's never turned off here).
 */
export async function updateSchedule(input: {
  row: Meeting;
  values: ScheduleValues;
  scope: SeriesScope;
  /** The occurrence being edited (its planned start), for "this" and "following". */
  occurrence: Date | null;
  googleCalendar: boolean;
}): Promise<void> {
  const { row, values, scope, occurrence } = input;
  const start = checked(values);
  const rule = ruleFor(values, start);
  // All or nothing: a failure halfway never leaves a series half edited.
  await db().transaction(async (tx) => {
    const series = await seriesOf(row.id, tx);
    const isSeries = series.rules.length > 0;
    const passcode = values.passcode
      ? (values.passcodeText ?? row.passcode ?? generatePasscode())
      : null;
    const common = {
      description: values.description || null,
      passcode,
      settings: settingsFrom(values),
      ...(input.googleCalendar
        ? { googleEvents: sql`coalesce(${meeting.googleEvents}, '{}'::jsonb)` }
        : {}),
    };

    if (isSeries && scope === "this" && occurrence) {
      await tx
        .insert(meetingException)
        .values({
          meetingId: row.id,
          originalStart: occurrence,
          startsAt: start,
          durationMin: values.durationMin,
          title: values.title === row.title ? null : values.title,
        })
        .onConflictDoUpdate({
          target: [meetingException.meetingId, meetingException.originalStart],
          set: {
            cancelled: false,
            startsAt: start,
            durationMin: values.durationMin,
            title: values.title === row.title ? null : values.title,
          },
        });
      await tx.update(meeting).set(common).where(eq(meeting.id, row.id));
      await replaceInvitations(tx, row.id, values);
      return;
    }

    let rules: RuleRow[];
    if (isSeries && scope === "following" && occurrence) {
      // The old rules stop just before this meeting; a new one starts here.
      const before = new Date(occurrence.getTime() - 1000);
      await tx
        .update(meetingRule)
        .set({ lastStart: before })
        .where(
          and(
            eq(meetingRule.meetingId, row.id),
            or(
              sql`${meetingRule.lastStart} is null`,
              sql`${meetingRule.lastStart} >= ${occurrence}`,
            ),
          ),
        );
      await tx
        .delete(meetingRule)
        .where(
          and(
            eq(meetingRule.meetingId, row.id),
            lt(meetingRule.lastStart, meetingRule.firstStart),
          ),
        );
      await tx
        .delete(meetingException)
        .where(
          and(
            eq(meetingException.meetingId, row.id),
            sql`${meetingException.originalStart} >= ${occurrence}`,
          ),
        );
      if (rule)
        await tx.insert(meetingRule).values({ meetingId: row.id, ...rule });
      rules = (await seriesOf(row.id, tx)).rules;
    } else {
      // All meetings (or a one-off): the rule is replaced, and old one-off changes go.
      await tx.delete(meetingRule).where(eq(meetingRule.meetingId, row.id));
      await tx
        .delete(meetingException)
        .where(eq(meetingException.meetingId, row.id));
      if (rule)
        await tx.insert(meetingRule).values({ meetingId: row.id, ...rule });
      rules = rule ? [{ ...rule, lastStart: null }] : [];
    }

    const firstStart = rules[0]?.firstStart ?? start;
    await tx
      .update(meeting)
      .set({
        ...common,
        title: values.title,
        startsAt: firstStart,
        durationMin: values.durationMin,
        timeZone: values.timeZone,
        expiresAt: expiryFor(firstStart, values.durationMin, rules),
      })
      .where(eq(meeting.id, row.id));
    await replaceInvitations(tx, row.id, values);
  });
}

/** Deletes one meeting of a series, it and the ones after it, or the whole meeting. */
export async function deleteSchedule(input: {
  row: Meeting;
  scope: SeriesScope;
  occurrence: Date | null;
}): Promise<void> {
  const { row, scope, occurrence } = input;
  await db().transaction(async (tx) => {
    const series = await seriesOf(row.id, tx);
    if (series.rules.length > 0 && occurrence && scope === "this") {
      await tx
        .insert(meetingException)
        .values({
          meetingId: row.id,
          originalStart: occurrence,
          cancelled: true,
        })
        .onConflictDoUpdate({
          target: [meetingException.meetingId, meetingException.originalStart],
          set: { cancelled: true },
        });
      return;
    }
    const firstStart = series.rules[0]?.firstStart;
    if (
      series.rules.length > 0 &&
      occurrence &&
      scope === "following" &&
      firstStart &&
      occurrence > firstStart
    ) {
      await tx
        .update(meetingRule)
        .set({ lastStart: new Date(occurrence.getTime() - 1000) })
        .where(
          and(
            eq(meetingRule.meetingId, row.id),
            or(
              sql`${meetingRule.lastStart} is null`,
              sql`${meetingRule.lastStart} >= ${occurrence}`,
            ),
          ),
        );
      await tx
        .delete(meetingRule)
        .where(
          and(
            eq(meetingRule.meetingId, row.id),
            sql`${meetingRule.firstStart} >= ${occurrence}`,
          ),
        );
      return;
    }
    // Everything: the link stops working.
    await tx
      .update(meeting)
      .set({ status: "cancelled" })
      .where(eq(meeting.id, row.id));
  });
}

export type UpcomingItem = {
  code: string;
  title: string | null;
  hostName: string;
  role: "host" | "invited";
  start: Date;
  end: Date;
  originalStart: Date;
  moved: boolean;
  /** The series' repeat rule, for the "Weekly" chip; null for a one-off. */
  rrule: string | null;
  invitedCount: number;
  waitingRoom: boolean;
  allowGuests: boolean;
  passcode: string | null;
  /** The meeting's own time zone, and the local date its repeat rule counts from. */
  timeZone: string;
  seriesStartDate: string;
};

/**
 * Upcoming: occurrences, between two moments, of scheduled meetings someone hosts or is
 * invited to (by their verified email).
 */
export async function upcomingFor(input: {
  userId: string;
  verifiedEmail: string | null;
  from: Date;
  to: Date;
}): Promise<UpcomingItem[]> {
  const invitedTo = input.verifiedEmail
    ? db()
        .select({ id: meetingInvitee.meetingId })
        .from(meetingInvitee)
        .where(eq(meetingInvitee.email, input.verifiedEmail.toLowerCase()))
    : null;
  const rows = await db()
    .select({ meeting, hostName: user.name })
    .from(meeting)
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(
      and(
        eq(meeting.type, "scheduled"),
        eq(meeting.status, "active"),
        or(
          eq(meeting.hostId, input.userId),
          invitedTo ? inArray(meeting.id, invitedTo) : undefined,
        ),
      ),
    );
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.meeting.id);
  const [rules, exceptions, invited] = await Promise.all([
    db().select().from(meetingRule).where(inArray(meetingRule.meetingId, ids)),
    db()
      .select()
      .from(meetingException)
      .where(inArray(meetingException.meetingId, ids)),
    db()
      .select({
        id: meetingInvitee.meetingId,
        count: sql<number>`count(*)::int`,
      })
      .from(meetingInvitee)
      .where(inArray(meetingInvitee.meetingId, ids))
      .groupBy(meetingInvitee.meetingId),
  ]);

  return rows
    .flatMap(({ meeting: raw, hostName }) => {
      const row = readMeeting(raw);
      const series = {
        rules: rules.filter((r) => r.meetingId === row.id),
        exceptions: exceptions.filter((e) => e.meetingId === row.id),
      };
      const role = row.hostId === input.userId ? "host" : "invited";
      const lastRule = series.rules.at(-1);
      const timeZone = lastRule?.timeZone ?? row.timeZone ?? "UTC";
      const seriesStartDate = localParts(
        lastRule?.firstStart ?? row.startsAt ?? new Date(),
        timeZone,
      ).date;
      return occurrencesOf(row, series, input.from, input.to).map(
        (occurrence): UpcomingItem => ({
          code: row.code,
          title: occurrence.title ?? row.title,
          hostName,
          role,
          start: occurrence.start,
          end: occurrence.end,
          originalStart: occurrence.originalStart,
          moved: occurrence.moved,
          rrule: lastRule?.rrule ?? null,
          invitedCount: invited.find((i) => i.id === row.id)?.count ?? 0,
          waitingRoom: row.settings.waitingRoom,
          allowGuests: row.settings.allowGuests,
          passcode: row.passcode,
          timeZone,
          seriesStartDate,
        }),
      );
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type DetailsOccurrence = {
  originalStart: string;
  start: string;
  end: string;
  moved: boolean;
  title: string | null;
};

/** Everything a scheduled meeting's page shows, ready to send to the browser. */
export type MeetingDetails = {
  code: string;
  passcode: string | null;
  title: string;
  description: string | null;
  hostName: string;
  isHost: boolean;
  timeZone: string;
  durationMin: number;
  /** The series' (or the meeting's) local start, for the repeat rule and the edit form. */
  startDate: string;
  startTime: string;
  rrule: string | null;
  next: DetailsOccurrence[];
  /** Everyone invited, named co-hosts marked. */
  invitees: Array<{
    email: string;
    name: string | null;
    image: string | null;
    cohost: boolean;
  }>;
  /** The host keeps it in their Google Calendar (Calendar sync); host only. */
  onGoogleCalendar: boolean;
  /** Made in Google Calendar (the Workspace add-on): the event, where its time is changed. */
  googleEventUrl: string | null;
  settings: Pick<
    MeetingSettings,
    | "waitingRoom"
    | "allowGuests"
    | "muteOnEntry"
    | "joinBeforeHost"
    | "autoNotes"
    | "shareNotes"
  >;
  cancelled: string[];
  moved: Array<{
    originalStart: string;
    start: string;
    end: string;
    title: string;
  }>;
};

const iso = (date: Date) => date.toISOString();

/**
 * A scheduled meeting for its page: its host sees everything; someone invited (by their
 * verified email) sees it too (the page shows the settings only to the host). Null for
 * anyone else.
 */
export async function meetingDetails(input: {
  code: string;
  viewer: { id: string; email: string; emailVerified: boolean };
  now?: Date;
}): Promise<MeetingDetails | null> {
  const [found] = await db()
    .select({ meeting, hostName: user.name })
    .from(meeting)
    .innerJoin(user, eq(user.id, meeting.hostId))
    .where(and(eq(meeting.code, input.code), eq(meeting.type, "scheduled")))
    .limit(1);
  if (!found || found.meeting.status !== "active") return null;
  const row = readMeeting(found.meeting);
  const isHost = row.hostId === input.viewer.id;
  const invitations = await invitationsOf(row.id);
  const invitees = invitations.everyone;
  const invited =
    input.viewer.emailVerified &&
    invitees.includes(input.viewer.email.toLowerCase());
  if (!isHost && !invited) return null;

  const series = await seriesOf(row.id);
  const now = input.now ?? new Date();
  const horizon = new Date(now.getTime() + 400 * DAY_MS);
  const next = occurrencesOf(row, series, now, horizon).slice(0, 4);
  const lastRule = series.rules.at(-1);
  const timeZone = lastRule?.timeZone ?? row.timeZone ?? "UTC";
  const first = lastRule?.firstStart ?? row.startsAt ?? now;
  const local = localParts(first, timeZone);

  // Names and pictures only for invitees who have already come to this meeting with a
  // verified account; anyone else is just their email. Otherwise inviting an address
  // would tell the host whether it has an account (and an unverified sign-up could
  // pick the name shown for someone else's email).
  const people =
    invitees.length > 0
      ? await db()
          .selectDistinct({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            avatarSeed: user.avatarSeed,
            avatarSource: user.avatarSource,
          })
          .from(user)
          .innerJoin(participantSession, eq(participantSession.userId, user.id))
          .innerJoin(
            meetingSession,
            eq(meetingSession.id, participantSession.sessionId),
          )
          .where(
            and(
              inArray(user.email, invitees),
              eq(user.emailVerified, true),
              eq(meetingSession.meetingId, row.id),
            ),
          )
      : [];

  return {
    code: row.code,
    passcode: row.passcode,
    title: row.title ?? "",
    description: row.description,
    hostName: found.hostName,
    isHost,
    timeZone,
    durationMin: lastRule?.durationMin ?? row.durationMin ?? 60,
    startDate: local.date,
    startTime: local.time,
    rrule: lastRule?.rrule ?? null,
    next: next.map((o) => ({
      originalStart: iso(o.originalStart),
      start: iso(o.start),
      end: iso(o.end),
      moved: o.moved,
      title: o.title,
    })),
    invitees: invitees.map((email) => {
      const person = people.find((p) => p.email.toLowerCase() === email);
      return {
        email,
        name: person?.name ?? null,
        image: person ? avatarUrl(person) : null,
        cohost: invitations.cohosts.includes(email),
      };
    }),
    onGoogleCalendar: isHost && row.googleEvents !== null,
    googleEventUrl:
      isHost && row.origin === "google_addon" && row.googleAddonEvent
        ? googleEventUrl(row.googleAddonEvent)
        : null,
    settings: {
      waitingRoom: row.settings.waitingRoom,
      allowGuests: row.settings.allowGuests,
      muteOnEntry: row.settings.muteOnEntry,
      joinBeforeHost: row.settings.joinBeforeHost,
      autoNotes: row.settings.autoNotes,
      shareNotes: row.settings.shareNotes,
    },
    cancelled: series.exceptions
      .filter((e) => e.cancelled)
      .map((e) => iso(e.originalStart)),
    moved: series.exceptions
      .filter((e) => !e.cancelled && (e.startsAt || e.durationMin))
      .map((e) => {
        const start = e.startsAt ?? e.originalStart;
        const minutes = e.durationMin ?? lastRule?.durationMin ?? 60;
        return {
          originalStart: iso(e.originalStart),
          start: iso(start),
          end: iso(new Date(start.getTime() + minutes * 60_000)),
          title: e.title ?? row.title ?? "",
        };
      }),
  };
}

/**
 * The next `days` days of a user's scheduled meetings, from yesterday on, so one under
 * way (or today's anywhere in the world) still shows.
 */
export function upcomingSoon(
  viewer: { id: string; email: string; emailVerified: boolean },
  days: number,
): Promise<UpcomingItem[]> {
  const now = Date.now();
  return upcomingFor({
    userId: viewer.id,
    verifiedEmail: viewer.emailVerified ? viewer.email : null,
    from: new Date(now - DAY_MS),
    to: new Date(now + days * DAY_MS),
  });
}

/**
 * A series that never ends stays reachable for a year after its latest session, like
 * Zoom's recurring meeting IDs. Called when a session opens.
 */
export async function keepOpenSeriesAlive(row: Meeting, now: Date) {
  if (row.type !== "scheduled") return;
  const { rules } = await seriesOf(row.id);
  if (!rules.some((rule) => lastStartOf(rule) === null)) return;
  await db()
    .update(meeting)
    .set({ expiresAt: new Date(now.getTime() + OPEN_SERIES_MS) })
    .where(eq(meeting.id, row.id));
}
