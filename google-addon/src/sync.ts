import { api } from "./api";
import {
  changesFrom,
  type CalendarEvent,
  type Change,
} from "./calendar-events";

/**
 * Keeping FaceOn's meetings in step with Calendar: one "event updated" trigger per
 * calendar, set up the first time someone adds FaceOn to an event there. Each run asks
 * Calendar what changed since the last (a sync token), and tells FaceOn about the events
 * that carry its meetings. A change FaceOn couldn't take right now is asked for again
 * next time; the sync token moves on only once everything got through.
 */
const HANDLER = "onCalendarEventUpdated";
const tokenKey = (calendarId: string) => `faceon.syncToken.${calendarId}`;
const eventKey = (eventId: string) => `faceon.event.${eventId}`;

/** Remembers which meeting an event has: a deleted event no longer says. */
export function rememberEvent(eventId: string, code: string): void {
  PropertiesService.getUserProperties().setProperty(eventKey(eventId), code);
}

export function ensureSyncTrigger(calendarId: string): void {
  const exists = ScriptApp.getProjectTriggers().some(
    (trigger) =>
      trigger.getHandlerFunction() === HANDLER &&
      trigger.getTriggerSourceId() === calendarId,
  );
  if (exists) return;
  ScriptApp.newTrigger(HANDLER)
    .forUserCalendar(calendarId)
    .onEventUpdated()
    .create();
}

export function onCalendarEventUpdated(event: { calendarId?: string }): void {
  const { calendarId } = event;
  if (!calendarId) return;
  const lock = LockService.getUserLock();
  if (!lock.tryLock(20_000)) return; // another run has it; it reads the same changes
  try {
    sync(calendarId);
  } finally {
    lock.releaseLock();
  }
}

function sync(calendarId: string): void {
  const properties = PropertiesService.getUserProperties();
  const { events, timeZone, nextSyncToken } = changedEvents(calendarId);
  const known = (eventId: string) => properties.getProperty(eventKey(eventId));
  let allThrough = true;
  for (const change of changesFrom(events, known, timeZone)) {
    if (!send(change)) allThrough = false;
  }
  if (allThrough && nextSyncToken) {
    properties.setProperty(tokenKey(calendarId), nextSyncToken);
  }
}

/** Tells FaceOn; false when it should be tried again later. */
function send(change: Change): boolean {
  const result =
    change.kind === "deleted"
      ? api.cancelConference(change.code)
      : api.updateConference(change.code, change.update);
  if (result.ok || result.error.code === "NOT_FOUND") {
    if (change.kind === "deleted") {
      PropertiesService.getUserProperties().deleteProperty(
        eventKey(change.eventId),
      );
    }
    return true;
  }
  // Only a passing problem is worth another try; anything else would fail the same way.
  return (
    result.error.code !== "TEMPORARY" && result.error.code !== "RATE_LIMITED"
  );
}

/** Everything that changed since the last run; the first run (or an expired token) reads from yesterday. */
function changedEvents(calendarId: string): {
  events: CalendarEvent[];
  timeZone?: string;
  nextSyncToken?: string;
} {
  const properties = PropertiesService.getUserProperties();
  let syncToken = properties.getProperty(tokenKey(calendarId));
  for (;;) {
    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;
    let timeZone: string | undefined;
    let nextSyncToken: string | undefined;
    try {
      do {
        const page = Calendar!.Events!.list(calendarId, {
          showDeleted: true,
          maxResults: 250,
          ...(pageToken ? { pageToken } : {}),
          ...(syncToken
            ? { syncToken }
            : { timeMin: new Date(Date.now() - 86_400_000).toISOString() }),
        });
        events.push(...((page.items ?? []) as CalendarEvent[]));
        timeZone = page.timeZone ?? timeZone;
        pageToken = page.nextPageToken ?? undefined;
        nextSyncToken = page.nextSyncToken ?? nextSyncToken;
      } while (pageToken);
      return { events, timeZone, nextSyncToken };
    } catch (error) {
      // 410 Gone: the sync token expired. Start again from yesterday.
      if (syncToken && /410|sync token/i.test(String(error))) {
        properties.deleteProperty(tokenKey(calendarId));
        syncToken = null;
        continue;
      }
      throw error;
    }
  }
}
