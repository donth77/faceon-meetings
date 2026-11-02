import { Temporal } from "temporal-polyfill";
import { describe, expect, it } from "vitest";

import type { ExceptionRow } from "@/lib/meetings/occurrences";

import {
  GoogleCalendarError,
  type CalendarApi,
  type EventBody,
  type EventTimeBody,
  type GoogleEvent,
} from "./api";
import {
  desiredEvents,
  SINGLE_EVENT,
  type CalendarMeeting,
  type CalendarRule,
} from "./events";
import { reconcile, type SeriesFacts } from "./reconcile";
import type { GoogleEventIds } from "./shared";

const NY = "America/New_York";
const at = (iso: string) => new Date(iso);

/** A wall-clock time back as Google returns it: an instant with its offset. */
const asReturned = (time: EventTimeBody | undefined) =>
  time && {
    dateTime: Temporal.PlainDateTime.from(time.dateTime)
      .toZonedDateTime(time.timeZone)
      .toString({ timeZoneName: "never" }),
    timeZone: time.timeZone,
  };

/**
 * Google Calendar in memory: events by ID, and a series' occurrences that the test
 * lists. Every call is logged ("insert e1 all", "patch e1 summary all"…).
 */
function fakeCalendar() {
  const events = new Map<string, GoogleEvent>();
  const occurrences = new Map<string, GoogleEvent[]>();
  const log: string[] = [];
  let next = 1;
  const apply = (event: GoogleEvent, body: EventBody): GoogleEvent => ({
    ...event,
    ...(body.summary !== undefined ? { summary: body.summary } : {}),
    ...(body.description !== undefined
      ? { description: body.description }
      : {}),
    ...(body.location !== undefined ? { location: body.location } : {}),
    ...(body.start ? { start: asReturned(body.start) } : {}),
    ...(body.end ? { end: asReturned(body.end) } : {}),
    ...(body.recurrence ? { recurrence: body.recurrence } : {}),
    ...(body.attendees ? { attendees: body.attendees } : {}),
    ...(body.extendedProperties
      ? { extendedProperties: body.extendedProperties }
      : {}),
  });
  const instance = (id: string) =>
    [...occurrences.values()].flat().find((o) => o.id === id);
  const api: CalendarApi = {
    get: async (id) => {
      log.push(`get ${id}`);
      const event = events.get(id);
      if (!event) throw new GoogleCalendarError("gone", 404);
      return event;
    },
    insert: async (body, sendUpdates) => {
      const id = `e${next++}`;
      log.push(`insert ${id} ${sendUpdates}`);
      const event = apply({ id, status: "confirmed" }, body);
      events.set(id, event);
      return event;
    },
    patch: async (id, body, sendUpdates) => {
      log.push(
        `patch ${id} ${Object.keys(body).sort().join(",")} ${sendUpdates}`,
      );
      const one = instance(id);
      if (one) {
        Object.assign(one, apply(one, body));
        return one;
      }
      const event = events.get(id);
      if (!event) throw new GoogleCalendarError("gone", 404);
      const changed = apply(event, body);
      events.set(id, changed);
      return changed;
    },
    remove: async (id, sendUpdates) => {
      log.push(`remove ${id} ${sendUpdates}`);
      const one = instance(id);
      if (one) one.status = "cancelled";
      else if (events.has(id)) events.delete(id);
      else throw new GoogleCalendarError("gone", 410);
    },
    instances: async (id) => {
      log.push(`instances ${id}`);
      return occurrences.get(id) ?? [];
    },
  };
  /** Gives a series event these occurrences (planned starts, one hour long). */
  const expand = (eventId: string, starts: string[]) =>
    occurrences.set(
      eventId,
      starts.map((start) => ({
        id: `${eventId}_${start.replace(/[-:]/g, "")}`,
        status: "confirmed",
        summary: events.get(eventId)?.summary,
        originalStartTime: { dateTime: start, timeZone: NY },
        start: { dateTime: start, timeZone: NY },
        end: {
          dateTime: new Date(Date.parse(start) + 3_600_000)
            .toISOString()
            .replace(".000", ""),
          timeZone: NY,
        },
      })),
    );
  return { api, events, log, expand };
}

const meeting: CalendarMeeting = {
  id: "8c0a6f53-2b1e-4c5f-9d3a-1f2e3d4c5b6a",
  code: "5843016279",
  passcode: null,
  title: "Product sync",
  active: true,
  startsAt: at("2026-11-03T19:00:00Z"),
  durationMin: 60,
  timeZone: NY,
};
const rule = (id: string, patch: Partial<CalendarRule> = {}): CalendarRule => ({
  id,
  rrule: "FREQ=WEEKLY;BYDAY=TU",
  firstStart: at("2026-11-03T19:00:00Z"),
  lastStart: null,
  durationMin: 60,
  timeZone: NY,
  ...patch,
});
const NOW = at("2026-11-02T12:00:00Z");

/** One pass, as the sync runs it, for a meeting in this shape. */
async function pass(
  calendar: ReturnType<typeof fakeCalendar>,
  ids: GoogleEventIds,
  shape: {
    meeting?: Partial<CalendarMeeting>;
    rules?: CalendarRule[];
    exceptions?: ExceptionRow[];
    guests?: string[];
  } = {},
) {
  const series: SeriesFacts = {
    rules: shape.rules ?? [],
    exceptions: shape.exceptions ?? [],
  };
  calendar.log.length = 0;
  await reconcile({
    api: calendar.api,
    desired: desiredEvents({
      meeting: { ...meeting, ...shape.meeting },
      rules: series.rules,
      guests: shape.guests ?? ["ben@example.com"],
      text: {
        description: "Join: https://meet.example/j/5843016279",
        link: "https://meet.example/j/5843016279",
        appName: "FaceOn",
      },
    }),
    series,
    ids,
    now: NOW,
  });
  return [...calendar.log];
}

describe("reconcile", () => {
  it("makes a new meeting's event once, then leaves it alone", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    expect(await pass(calendar, ids)).toEqual(["insert e1 all"]);
    expect(ids).toEqual({ [SINGLE_EVENT]: "e1" });
    expect(await pass(calendar, ids)).toEqual(["get e1"]);
  });

  it("sends only what changed", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids);
    expect(
      await pass(calendar, ids, {
        meeting: { title: "Roadmap" },
        guests: ["ben@example.com", "ana@example.com"],
      }),
    ).toEqual(["get e1", "patch e1 attendees,summary all"]);
  });

  it("turns a one-off into a series by updating its event", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids);
    expect(await pass(calendar, ids, { rules: [rule("r1")] })).toEqual([
      "get e1",
      "patch e1 extendedProperties,recurrence all",
    ]);
    expect(ids).toEqual({ r1: "e1" });
    expect(calendar.events.get("e1")?.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=TU",
    ]);
  });

  it("splits a series for “this and following”, as Google does", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids, { rules: [rule("r1")] });
    const log = await pass(calendar, ids, {
      rules: [
        rule("r1", { lastStart: at("2026-11-17T18:59:59Z") }),
        rule("r2", {
          rrule: "FREQ=WEEKLY;BYDAY=TH",
          firstStart: at("2026-11-19T19:00:00Z"),
        }),
      ],
    });
    expect(log).toEqual(["get e1", "patch e1 recurrence all", "insert e2 all"]);
    expect(calendar.events.get("e1")?.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T185959Z",
    ]);
    expect(ids).toEqual({ r1: "e1", r2: "e2" });
  });

  it("folds a split series back into one event for “all meetings”", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids, {
      rules: [
        rule("r1", { lastStart: at("2026-11-17T18:59:59Z") }),
        rule("r2", { firstStart: at("2026-11-24T19:00:00Z") }),
      ],
    });
    const log = await pass(calendar, ids, {
      rules: [rule("r3", { firstStart: at("2026-11-24T20:00:00Z") })],
    });
    expect(log).toEqual([
      "get e1",
      "patch e1 end,extendedProperties,recurrence,start all",
      "remove e2 all",
    ]);
    expect(ids).toEqual({ r3: "e1" });
  });

  it("replaces a series' event when it becomes a one-off", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids, { rules: [rule("r1")] });
    expect(await pass(calendar, ids)).toEqual([
      "get e1",
      "remove e1 all",
      "insert e2 all",
    ]);
    expect(ids).toEqual({ [SINGLE_EVENT]: "e2" });
  });

  it("removes every event of a deleted meeting", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids, { rules: [rule("r1"), rule("r2")] });
    expect(
      await pass(calendar, ids, {
        meeting: { active: false },
        rules: [rule("r1"), rule("r2")],
      }),
    ).toEqual(["remove e1 all", "remove e2 all"]);
    expect(ids).toEqual({});
  });

  it("respects an event the host deleted in Google, and remakes a missing one", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids);
    calendar.events.set("e1", { id: "e1", status: "cancelled" });
    expect(
      await pass(calendar, ids, { meeting: { title: "Roadmap" } }),
    ).toEqual(["get e1"]);
    calendar.events.delete("e1");
    expect(await pass(calendar, ids)).toEqual(["get e1", "insert e2 all"]);
    expect(ids).toEqual({ [SINGLE_EVENT]: "e2" });
  });

  it("cancels and moves single occurrences, once", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    await pass(calendar, ids, { rules: [rule("r1")] });
    calendar.expand("e1", [
      "2026-11-03T19:00:00Z",
      "2026-11-10T19:00:00Z",
      "2026-11-17T19:00:00Z",
    ]);
    const exceptions: ExceptionRow[] = [
      {
        originalStart: at("2026-11-10T19:00:00Z"),
        cancelled: true,
        startsAt: null,
        durationMin: null,
        title: null,
      },
      {
        originalStart: at("2026-11-17T19:00:00Z"),
        cancelled: false,
        startsAt: at("2026-11-17T21:00:00Z"),
        durationMin: null,
        title: null,
      },
    ];
    expect(
      await pass(calendar, ids, { rules: [rule("r1")], exceptions }),
    ).toEqual([
      "get e1",
      "instances e1",
      "remove e1_20261110T190000Z all",
      "patch e1_20261117T190000Z end,start all",
    ]);
    expect(
      await pass(calendar, ids, { rules: [rule("r1")], exceptions }),
    ).toEqual(["get e1", "instances e1"]);
  });

  it("keeps what went through when Google fails partway", async () => {
    const calendar = fakeCalendar();
    const ids: GoogleEventIds = {};
    const insert = calendar.api.insert;
    let calls = 0;
    calendar.api.insert = async (body, sendUpdates) => {
      calls += 1;
      if (calls === 2) throw new GoogleCalendarError("unavailable", 503);
      return insert(body, sendUpdates);
    };
    await expect(
      pass(calendar, ids, { rules: [rule("r1"), rule("r2")] }),
    ).rejects.toThrow(GoogleCalendarError);
    expect(ids).toEqual({ r1: "e1" });
    // Trying again makes only the missing one.
    expect(
      await pass(calendar, ids, { rules: [rule("r1"), rule("r2")] }),
    ).toEqual(["get e1", "insert e2 all"]);
  });
});
