/**
 * One pass that brings a meeting's events in its host's Google Calendar in line with
 * the events it should have (events.ts). Safe to repeat: it only changes what differs,
 * so a retry after a failure (or after reconnecting) picks up where it stopped.
 */
import { ruleWithStart, type ExceptionRow } from "@/lib/meetings/occurrences";

import { GoogleCalendarError, type CalendarApi, type GoogleEvent } from "./api";
import {
  currentExceptions,
  eventChanges,
  exceptionsWindow,
  instanceChanges,
  planEvents,
  type CalendarRule,
  type DesiredEvent,
  type EventPlan,
} from "./events";
import type { GoogleEventIds } from "./shared";

/** The series facts the occurrences need: its rules and one-off changes. */
export type SeriesFacts = {
  rules: CalendarRule[];
  exceptions: ExceptionRow[];
};

/** The event, or null when it isn't in this calendar (deleted long ago, or never here). */
async function find(api: CalendarApi, eventId: string) {
  try {
    return await api.get(eventId);
  } catch (error) {
    if (error instanceof GoogleCalendarError && error.problem === "gone") {
      return null;
    }
    throw error;
  }
}

/** Deletes an event or one occurrence; one that's already gone is fine. */
async function remove(api: CalendarApi, eventId: string) {
  try {
    await api.remove(eventId, "all");
  } catch (error) {
    if (!(error instanceof GoogleCalendarError) || error.problem !== "gone") {
      throw error;
    }
  }
}

/**
 * Brings one wanted event in line: updates the existing event, or makes it. Returns
 * the event as it now stands (null when the host deleted it in Google, which FaceOn
 * respects), after recording its ID in `ids`.
 */
async function settle(
  api: CalendarApi,
  ids: GoogleEventIds,
  entry: EventPlan["keep"][number],
): Promise<GoogleEvent | null> {
  const { desired, previousKey } = entry;
  const claim = (eventId: string) => {
    if (previousKey && previousKey !== desired.key) delete ids[previousKey];
    ids[desired.key] = eventId;
  };
  const make = async () => {
    const made = await api.insert(desired.body, "all");
    claim(made.id);
    return made;
  };

  if (!entry.eventId) return make();
  const actual = await find(api, entry.eventId);
  // Not in this calendar (another Google account was connected since): make it here.
  if (!actual) return make();
  claim(actual.id);
  if (actual.status === "cancelled") return null;

  // A series can't be patched into a one-off: replace it.
  if (actual.recurrence?.length && !desired.body.recurrence) {
    await remove(api, actual.id);
    delete ids[desired.key];
    return make();
  }
  const changes = eventChanges(actual, desired);
  if (!changes) return actual;
  try {
    return await api.patch(actual.id, changes.body, changes.sendUpdates);
  } catch (error) {
    // Making a one-off repeat is a patch Google may refuse; replacing it always works.
    if (
      error instanceof GoogleCalendarError &&
      error.problem === "rejected" &&
      changes.body.recurrence
    ) {
      await remove(api, actual.id);
      delete ids[desired.key];
      return make();
    }
    throw error;
  }
}

/** Cancels, moves or retitles a series' occurrences as FaceOn's one-off changes say. */
async function settleOccurrences(
  api: CalendarApi,
  event: GoogleEvent,
  desired: DesiredEvent & { rule: CalendarRule },
  series: SeriesFacts,
  now: Date,
) {
  const { rule } = desired;
  const changes = currentExceptions(series.exceptions, now).filter(
    (change) =>
      ruleWithStart(series.rules, change.originalStart)?.id === rule.id,
  );
  const window = exceptionsWindow(changes, rule.durationMin);
  if (!window) return;
  const instances = await api.instances(event.id, window.from, window.to);
  for (const change of instanceChanges({
    rule,
    title: desired.body.summary ?? "",
    exceptions: changes,
    instances,
  })) {
    if (change.kind === "cancel") await remove(api, change.instanceId);
    else await api.patch(change.instanceId, change.body, "all");
  }
}

/**
 * Makes, updates or removes the meeting's events, then its occurrences' one-off
 * changes. `ids` (event ID by key) is updated as each change lands, so whatever went
 * through is remembered even if a later call fails.
 */
export async function reconcile(input: {
  api: CalendarApi;
  desired: DesiredEvent[];
  series: SeriesFacts;
  ids: GoogleEventIds;
  now?: Date;
}): Promise<void> {
  const { api, series, ids } = input;
  const now = input.now ?? new Date();
  const plan = planEvents(input.desired, ids);
  for (const entry of plan.keep) {
    const event = await settle(api, ids, entry);
    const { desired } = entry;
    if (event && desired.rule) {
      await settleOccurrences(
        api,
        event,
        { ...desired, rule: desired.rule },
        series,
        now,
      );
    }
  }
  for (const { key, eventId } of plan.remove) {
    await remove(api, eventId);
    delete ids[key];
  }
}
