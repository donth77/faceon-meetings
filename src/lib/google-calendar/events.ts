/**
 * What a meeting should look like in its host's Google Calendar, and the smallest set
 * of changes that gets it there. Pure: the sync (sync.ts) does the fetching.
 *
 * A one-off meeting is one event. A series is one recurring event per repeat rule
 * ("this and following" edits end a rule and start another, as Google does). One-off
 * changes to a series ("this meeting") change or cancel that event's instance.
 */
import { formatMeetingCode } from "@/lib/meetings/codes";
import {
  lastStartOf,
  localDateTime,
  type ExceptionRow,
  type RuleRow,
} from "@/lib/meetings/occurrences";

import type {
  Attendee,
  EventBody,
  EventTimeBody,
  GoogleEvent,
  SendUpdates,
} from "./api";
import type { GoogleEventIds } from "./shared";

/** The key of a one-off meeting's event; a series' events use their rule's ID. */
export const SINGLE_EVENT = "single";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A scheduled meeting, as its calendar events need it. */
export type CalendarMeeting = {
  id: string;
  code: string;
  passcode: string | null;
  title: string;
  /** Deleted meetings (or a whole deleted series) keep no events. */
  active: boolean;
  startsAt: Date | null;
  durationMin: number | null;
  timeZone: string | null;
};

/** A series' repeat rule; its ID keys its event. */
export type CalendarRule = RuleRow & { id: string };

/** The text and link every event of a meeting carries. */
export type EventText = {
  /** The event's description: the agenda, then how to join. */
  description: string;
  /** The join link, which is also the event's location. */
  link: string;
  appName: string;
};

/** One event the meeting should have, and the facts it was made from. */
export type DesiredEvent = {
  key: string;
  body: EventBody;
  start: Date;
  end: Date;
  timeZone: string;
  /** The repeat rule, for a series' event. */
  rule: CalendarRule | null;
};

/** A wall-clock time in a time zone, as Calendar takes it with `timeZone` beside it. */
export const wallTime = (instant: Date, timeZone: string): EventTimeBody => ({
  dateTime: `${localDateTime(instant, timeZone)}:00`,
  timeZone,
});

/** "20261103T150000Z": an RRULE UNTIL. */
const untilStamp = (instant: Date) =>
  instant
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/**
 * A rule as Calendar should repeat it. A rule that a later "this and following" edit
 * ended (lastStart) stops there, unless it already ended sooner on its own.
 */
export function seriesRRule(rule: RuleRow): string {
  if (!rule.lastStart) return rule.rrule;
  const natural = lastStartOf({ ...rule, lastStart: null });
  if (natural && natural <= rule.lastStart) return rule.rrule;
  const parts = rule.rrule
    .split(";")
    .filter((part) => !/^(COUNT|UNTIL)=/i.test(part));
  return [...parts, `UNTIL=${untilStamp(rule.lastStart)}`].join(";");
}

/** The people Google invites: each invitee once, never the host themselves. */
export function guestsOf(invitees: string[], hostEmail: string): string[] {
  const host = hostEmail.toLowerCase();
  return [...new Set(invitees.map((email) => email.toLowerCase()))].filter(
    (email) => email !== host,
  );
}

/** The events a meeting should have in its host's calendar, in the order of its rules. */
export function desiredEvents(input: {
  meeting: CalendarMeeting;
  rules: CalendarRule[];
  guests: string[];
  text: EventText;
}): DesiredEvent[] {
  const { meeting, rules, guests, text } = input;
  if (!meeting.active) return [];
  const make = (
    key: string,
    start: Date,
    minutes: number,
    timeZone: string,
    rule: CalendarRule | null,
  ): DesiredEvent => {
    const end = new Date(start.getTime() + minutes * 60_000);
    return {
      key,
      start,
      end,
      timeZone,
      rule,
      body: {
        summary: meeting.title,
        description: text.description,
        location: text.link,
        start: wallTime(start, timeZone),
        end: wallTime(end, timeZone),
        ...(rule ? { recurrence: [`RRULE:${seriesRRule(rule)}`] } : {}),
        attendees: guests.map((email) => ({ email })),
        extendedProperties: {
          private: { faceonMeetingId: meeting.id, faceonEventKey: key },
        },
        source: { title: text.appName, url: text.link },
      },
    };
  };
  if (rules.length === 0) {
    if (!meeting.startsAt || !meeting.durationMin) return [];
    return [
      make(
        SINGLE_EVENT,
        meeting.startsAt,
        meeting.durationMin,
        meeting.timeZone ?? "UTC",
        null,
      ),
    ];
  }
  return rules.map((rule) =>
    make(rule.id, rule.firstStart, rule.durationMin, rule.timeZone, rule),
  );
}

/**
 * Each wanted event with the existing event to bring in line (and the key it had), or
 * none to make one; and the existing events nobody wants any more.
 */
export type EventPlan = {
  keep: Array<{
    desired: DesiredEvent;
    eventId: string | null;
    previousKey: string | null;
  }>;
  remove: Array<{ key: string; eventId: string }>;
};

/**
 * Pairs the events a meeting should have with the ones it has. An event whose key went
 * (a series edited as a whole, a one-off made to repeat) is reused for a new key, so
 * invitees get an update instead of a cancellation and a new invitation.
 */
export function planEvents(
  desired: DesiredEvent[],
  existing: GoogleEventIds,
): EventPlan {
  const wanted = new Set(desired.map((event) => event.key));
  const spare = Object.entries(existing).filter(([key]) => !wanted.has(key));
  const keep = desired.map((event) => {
    const own = existing[event.key];
    if (own) return { desired: event, eventId: own, previousKey: event.key };
    const [previousKey = null, eventId = null] = spare.shift() ?? [];
    return { desired: event, eventId, previousKey };
  });
  return {
    keep,
    remove: spare.map(([key, eventId]) => ({ key, eventId })),
  };
}

const instant = (time: { dateTime?: string } | undefined) =>
  time?.dateTime ? Date.parse(time.dateTime) : Number.NaN;

/** Recurrence lines compared without regard to the order of their parts. */
const canonical = (lines: string[] | undefined) =>
  (lines ?? [])
    .map((line) => {
      const upper = line.trim().toUpperCase();
      const colon = upper.indexOf(":");
      const value = upper
        .slice(colon + 1)
        .split(";")
        .sort()
        .join(";");
      return `${upper.slice(0, colon + 1)}${value}`;
    })
    .sort()
    .join("\n");

/** A guest Google emails: not the host, not a room. */
const isGuest = (
  attendee: Attendee,
): attendee is Attendee & { email: string } =>
  Boolean(attendee.email) &&
  !attendee.organizer &&
  !attendee.self &&
  !attendee.resource;

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * The fields of an event that differ from what FaceOn wants, ready for a patch, and
 * whether guests should hear about it; null when nothing differs. Guests who stay keep
 * their answers (yes, no, maybe).
 */
export function eventChanges(
  actual: GoogleEvent,
  desired: DesiredEvent,
): { body: EventBody; sendUpdates: SendUpdates } | null {
  const want = desired.body;
  const body: EventBody = {};
  if ((actual.summary ?? "") !== want.summary) body.summary = want.summary;
  if ((actual.description ?? "").replace(/\r\n/g, "\n") !== want.description) {
    body.description = want.description;
  }
  if ((actual.location ?? "") !== want.location) body.location = want.location;
  if (
    instant(actual.start) !== desired.start.getTime() ||
    instant(actual.end) !== desired.end.getTime() ||
    actual.start?.timeZone !== desired.timeZone ||
    actual.end?.timeZone !== desired.timeZone
  ) {
    body.start = want.start;
    body.end = want.end;
  }
  if (canonical(actual.recurrence) !== canonical(want.recurrence)) {
    body.recurrence = want.recurrence ?? [];
  }
  const attendees = actual.attendees ?? [];
  const guests = attendees
    .filter(isGuest)
    .map((attendee) => attendee.email.toLowerCase());
  const wanted = (want.attendees ?? []).flatMap((a) =>
    a.email ? [a.email.toLowerCase()] : [],
  );
  if (!sameSet(guests, wanted)) {
    body.attendees = [
      ...attendees.filter((attendee) => !isGuest(attendee)),
      ...wanted.map(
        (email) =>
          attendees.find((a) => a.email?.toLowerCase() === email) ?? { email },
      ),
    ];
  }
  const ours = want.extendedProperties?.private ?? {};
  const theirs = actual.extendedProperties?.private ?? {};
  const tagged = Object.entries(ours).every(
    ([key, value]) => theirs[key] === value,
  );
  if (Object.keys(body).length === 0 && tagged) return null;
  const sendUpdates: SendUpdates =
    Object.keys(body).length > 0 ? "all" : "none";
  if (!tagged) body.extendedProperties = { private: { ...theirs, ...ours } };
  return { body, sendUpdates };
}

/** One occurrence of a series to change in Calendar. */
export type InstanceChange =
  | { kind: "cancel"; instanceId: string }
  | { kind: "change"; instanceId: string; body: EventBody };

/** Changes worth sending: to occurrences from yesterday on. Older ones are history. */
const current = (change: ExceptionRow, now: Date) =>
  Math.max(change.originalStart.getTime(), change.startsAt?.getTime() ?? 0) >=
  now.getTime() - DAY_MS;

/** A rule's one-off changes that Calendar should still show. */
export function currentExceptions(
  exceptions: ExceptionRow[],
  now: Date,
): ExceptionRow[] {
  return exceptions.filter((change) => current(change, now));
}

/** The stretch of time that holds these changes' occurrences, before and after moving. */
export function exceptionsWindow(
  exceptions: ExceptionRow[],
  durationMin: number,
): { from: Date; to: Date } | null {
  if (exceptions.length === 0) return null;
  const times = exceptions.flatMap((change) => [
    change.originalStart.getTime(),
    ...(change.startsAt ? [change.startsAt.getTime()] : []),
  ]);
  const longest = Math.max(
    durationMin,
    ...exceptions.map((change) => change.durationMin ?? 0),
  );
  return {
    from: new Date(Math.min(...times) - DAY_MS),
    to: new Date(Math.max(...times) + longest * 60_000 + DAY_MS),
  };
}

/**
 * How a series' occurrences in Calendar should change to match FaceOn's one-off
 * changes: cancelled ones cancelled, moved or retitled ones changed. Occurrences the
 * host cancelled in Google stay cancelled.
 */
export function instanceChanges(input: {
  rule: CalendarRule;
  title: string;
  exceptions: ExceptionRow[];
  instances: GoogleEvent[];
}): InstanceChange[] {
  const { rule, title } = input;
  return input.exceptions.flatMap((change): InstanceChange[] => {
    const instance = input.instances.find(
      (candidate) =>
        instant(candidate.originalStartTime) === change.originalStart.getTime(),
    );
    if (!instance) return [];
    if (change.cancelled) {
      return instance.status === "cancelled"
        ? []
        : [{ kind: "cancel", instanceId: instance.id }];
    }
    if (instance.status === "cancelled") return [];
    const start = change.startsAt ?? change.originalStart;
    const end = new Date(
      start.getTime() + (change.durationMin ?? rule.durationMin) * 60_000,
    );
    const summary = change.title ?? title;
    const body: EventBody = {};
    if (
      instant(instance.start) !== start.getTime() ||
      instant(instance.end) !== end.getTime()
    ) {
      body.start = wallTime(start, rule.timeZone);
      body.end = wallTime(end, rule.timeZone);
    }
    if ((instance.summary ?? "") !== summary) body.summary = summary;
    return Object.keys(body).length > 0
      ? [{ kind: "change", instanceId: instance.id, body }]
      : [];
  });
}

/** The invitation lines of an event's description, in the host's language. */
export type InvitationLine =
  | "invitation.scheduledIntro"
  | "invitation.join"
  | "invitation.meetingId"
  | "invitation.passcode";

/**
 * An event's description: the meeting's own description (the agenda), then how to
 * join. Calendar shows the time and how it repeats, so the text leaves those out.
 */
export function eventDescription(
  t: (line: InvitationLine, values: Record<string, string>) => string,
  meeting: {
    agenda: string | null;
    hostName: string;
    appName: string;
    link: string;
    code: string;
    passcode: string | null;
  },
): string {
  return [
    ...(meeting.agenda ? [meeting.agenda, ""] : []),
    t("invitation.scheduledIntro", {
      host: meeting.hostName,
      appName: meeting.appName,
    }),
    t("invitation.join", { link: meeting.link }),
    t("invitation.meetingId", { code: formatMeetingCode(meeting.code) }),
    ...(meeting.passcode
      ? [t("invitation.passcode", { passcode: meeting.passcode })]
      : []),
  ].join("\n");
}
