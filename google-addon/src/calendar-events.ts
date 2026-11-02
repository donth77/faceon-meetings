/**
 * Reading Google Calendar's events: their time for FaceOn, and what changed for the
 * meetings FaceOn made. Pure (Calendar's resources in, plain values out), so it's tested
 * without Apps Script.
 */
import type {
  ConferenceUpdate,
  EventTiming,
} from "../../src/lib/addon/google/types";

/** The parts of a Calendar API event the add-on reads. */
export type CalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  recurringEventId?: string;
  recurrence?: string[];
  organizer?: { self?: boolean };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  originalStartTime?: { date?: string; dateTime?: string; timeZone?: string };
  conferenceData?: {
    conferenceId?: string;
    conferenceSolution?: { key?: { type?: string } };
    parameters?: {
      addOnParameters?: { parameters?: Record<string, string | undefined> };
    };
  };
};

/** The conference parameter that marks FaceOn's meetings (it's their meeting ID). */
export const CODE_PARAMETER = "faceonCode";

/** The FaceOn meeting ID an event carries, when its conference is FaceOn's. */
export function codeOf(event: CalendarEvent): string | null {
  const data = event.conferenceData;
  if (data?.conferenceSolution?.key?.type !== "addOn") return null;
  return data.parameters?.addOnParameters?.parameters?.[CODE_PARAMETER] ?? null;
}

const instant = (moment: { date?: string; dateTime?: string } | undefined) =>
  moment?.dateTime ?? (moment?.date ? `${moment.date}T00:00:00Z` : undefined);

/** An event's title, time and repeat for FaceOn; undefined when it has no time yet. */
export function timingOf(
  event: CalendarEvent,
  calendarTimeZone?: string,
): EventTiming | undefined {
  const start = instant(event.start);
  const end = instant(event.end);
  if (!start || !end) return undefined;
  return {
    ...(event.summary ? { title: event.summary } : {}),
    start,
    end,
    ...((event.start?.timeZone ?? calendarTimeZone)
      ? { timeZone: event.start?.timeZone ?? calendarTimeZone }
      : {}),
    ...(event.start?.date ? { allDay: true } : {}),
    ...(event.recurrence?.length ? { recurrence: event.recurrence } : {}),
  };
}

/** One thing FaceOn should hear about a meeting it made from Calendar. */
export type Change =
  | { kind: "update"; code: string; update: ConferenceUpdate }
  | { kind: "deleted"; code: string; eventId: string };

/**
 * What changed, from the events Calendar says changed. `known` gives the meeting ID the
 * add-on remembered for an event: deleted events say almost nothing about themselves.
 * Only events this calendar organizes count; on an invitee's copy, the organizer's
 * add-on keeps the meeting.
 */
export function changesFrom(
  events: readonly CalendarEvent[],
  known: (eventId: string) => string | null,
  calendarTimeZone?: string,
): Change[] {
  const changes: Change[] = [];
  for (const event of events) {
    const masterId = event.recurringEventId ?? event.id;
    if (!masterId) continue;
    const own = codeOf(event);
    const code = own ?? known(masterId);
    if (!code) continue;
    const original = instant(event.originalStartTime);

    if (event.status === "cancelled") {
      if (event.recurringEventId && original) {
        changes.push({
          kind: "update",
          code,
          update: { occurrence: { originalStart: original, cancelled: true } },
        });
      } else if (!event.recurringEventId) {
        changes.push({ kind: "deleted", code, eventId: masterId });
      }
      continue;
    }
    if (event.organizer?.self !== true) continue;
    if (!own) {
      // FaceOn's conference was taken off the event (or swapped for another): the meeting goes.
      if (!event.recurringEventId) {
        changes.push({ kind: "deleted", code, eventId: masterId });
      }
      continue;
    }
    const timing = timingOf(event, calendarTimeZone);
    if (!timing) continue;
    if (event.recurringEventId && original) {
      changes.push({
        kind: "update",
        code,
        update: {
          occurrence: {
            originalStart: original,
            start: timing.start,
            end: timing.end,
          },
        },
      });
    } else {
      changes.push({ kind: "update", code, update: { event: timing } });
    }
  }
  return changes;
}
