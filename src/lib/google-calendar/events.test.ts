import { describe, expect, it } from "vitest";

import type { GoogleEvent } from "./api";
import {
  cancellationOnLeaving,
  currentExceptions,
  desiredEvents,
  eventChanges,
  eventDescription,
  exceptionsWindow,
  guestsOf,
  instanceChanges,
  planEvents,
  seriesRRule,
  SINGLE_EVENT,
  wallTime,
  type CalendarMeeting,
  type CalendarRule,
} from "./events";

const NY = "America/New_York";
const at = (iso: string) => new Date(iso);

const meeting: CalendarMeeting = {
  id: "8c0a6f53-2b1e-4c5f-9d3a-1f2e3d4c5b6a",
  code: "5843016279",
  passcode: "K7XQ2M",
  title: "Product sync",
  active: true,
  startsAt: at("2026-11-03T19:00:00Z"),
  durationMin: 60,
  timeZone: NY,
};
const text = {
  description: "Join: https://meet.example/j/5843016279#pwd=K7XQ2M",
  link: "https://meet.example/j/5843016279#pwd=K7XQ2M",
  appName: "FaceOn",
};
const weekly: CalendarRule = {
  id: "rule-1",
  rrule: "FREQ=WEEKLY;BYDAY=TU",
  firstStart: at("2026-11-03T19:00:00Z"),
  lastStart: null,
  durationMin: 60,
  timeZone: NY,
};

describe("wallTime", () => {
  it("gives the local time in the meeting's zone, as Calendar takes it", () => {
    expect(wallTime(at("2026-11-03T19:00:00Z"), NY)).toEqual({
      dateTime: "2026-11-03T14:00:00",
      timeZone: NY,
    });
    // Summer time: the same local time is a different UTC hour.
    expect(wallTime(at("2026-07-07T18:00:00Z"), NY).dateTime).toBe(
      "2026-07-07T14:00:00",
    );
  });
});

describe("seriesRRule", () => {
  it("keeps a rule that runs its course", () => {
    expect(seriesRRule(weekly)).toBe("FREQ=WEEKLY;BYDAY=TU");
  });

  it("ends a rule that a later edit cut short, in place of its own end", () => {
    const cut = {
      ...weekly,
      rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=20",
      lastStart: at("2026-11-17T18:59:59Z"),
    };
    expect(seriesRRule(cut)).toBe(
      "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T185959Z",
    );
  });

  it("keeps a rule's own end when it comes first", () => {
    const short = {
      ...weekly,
      rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=2",
      lastStart: at("2026-12-29T18:59:59Z"),
    };
    expect(seriesRRule(short)).toBe("FREQ=WEEKLY;BYDAY=TU;COUNT=2");
  });
});

describe("guestsOf", () => {
  it("invites each address once, never the host", () => {
    expect(
      guestsOf(
        ["Ben@Example.com", "ben@example.com", "maya@example.com"],
        "MAYA@example.com",
      ),
    ).toEqual(["ben@example.com"]);
  });
});

describe("desiredEvents", () => {
  it("makes one event for a one-off meeting", () => {
    const [event, ...rest] = desiredEvents({
      meeting,
      rules: [],
      guests: ["ben@example.com"],
      text,
    });
    expect(rest).toEqual([]);
    expect(event?.key).toBe(SINGLE_EVENT);
    expect(event?.rule).toBeNull();
    expect(event?.body).toEqual({
      summary: "Product sync",
      description: text.description,
      location: text.link,
      start: { dateTime: "2026-11-03T14:00:00", timeZone: NY },
      end: { dateTime: "2026-11-03T15:00:00", timeZone: NY },
      attendees: [{ email: "ben@example.com" }],
      extendedProperties: {
        private: { faceonMeetingId: meeting.id, faceonEventKey: SINGLE_EVENT },
      },
      source: { title: "FaceOn", url: text.link },
    });
  });

  it("makes a recurring event for each of a series' rules", () => {
    const later: CalendarRule = {
      ...weekly,
      id: "rule-2",
      rrule: "FREQ=WEEKLY;BYDAY=TH",
      firstStart: at("2026-11-19T20:00:00Z"),
      durationMin: 30,
    };
    const events = desiredEvents({
      meeting,
      rules: [{ ...weekly, lastStart: at("2026-11-17T18:59:59Z") }, later],
      guests: [],
      text,
    });
    expect(events.map((event) => event.key)).toEqual(["rule-1", "rule-2"]);
    expect(events[0]?.body.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20261117T185959Z",
    ]);
    expect(events[1]?.body.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=TH"]);
    expect(events[1]?.body.start).toEqual({
      dateTime: "2026-11-19T15:00:00",
      timeZone: NY,
    });
    expect(events[1]?.body.end?.dateTime).toBe("2026-11-19T15:30:00");
  });

  it("wants no events for a deleted meeting", () => {
    expect(
      desiredEvents({
        meeting: { ...meeting, active: false },
        rules: [weekly],
        guests: [],
        text,
      }),
    ).toEqual([]);
  });
});

describe("planEvents", () => {
  const desired = (keys: string[]) =>
    desiredEvents({
      meeting,
      rules: keys.map((id) => ({ ...weekly, id })),
      guests: [],
      text,
    });

  it("keeps each event for its own key and makes the missing ones", () => {
    const plan = planEvents(desired(["a", "b"]), { a: "event-a" });
    expect(
      plan.keep.map(({ desired: d, eventId, previousKey }) => [
        d.key,
        eventId,
        previousKey,
      ]),
    ).toEqual([
      ["a", "event-a", "a"],
      ["b", null, null],
    ]);
    expect(plan.remove).toEqual([]);
  });

  it("reuses an event whose key went, and removes the rest", () => {
    const plan = planEvents(desired(["c"]), { a: "event-a", b: "event-b" });
    expect(plan.keep[0]).toMatchObject({
      eventId: "event-a",
      previousKey: "a",
    });
    expect(plan.remove).toEqual([{ key: "b", eventId: "event-b" }]);
  });
});

describe("eventChanges", () => {
  const [wanted] = desiredEvents({
    meeting,
    rules: [weekly],
    guests: ["ben@example.com", "ana@example.com"],
    text,
  });
  if (!wanted) throw new Error("no event");
  const asGoogleHasIt: GoogleEvent = {
    id: "event-1",
    status: "confirmed",
    summary: "Product sync",
    description: text.description,
    location: text.link,
    start: { dateTime: "2026-11-03T14:00:00-05:00", timeZone: NY },
    end: { dateTime: "2026-11-03T15:00:00-05:00", timeZone: NY },
    recurrence: ["RRULE:BYDAY=TU;FREQ=WEEKLY"],
    attendees: [
      { email: "maya@example.com", organizer: true, self: true },
      { email: "ben@example.com", responseStatus: "accepted" },
      { email: "ana@example.com", responseStatus: "needsAction" },
    ],
    extendedProperties: {
      private: { faceonMeetingId: meeting.id, faceonEventKey: "rule-1" },
    },
  };

  it("changes nothing when Google already has it right", () => {
    expect(eventChanges(asGoogleHasIt, wanted)).toBeNull();
  });

  it("sends only what changed, and tells the guests", () => {
    expect(
      eventChanges({ ...asGoogleHasIt, summary: "Old title" }, wanted),
    ).toEqual({ body: { summary: "Product sync" }, sendUpdates: "all" });
    const moved = eventChanges(
      {
        ...asGoogleHasIt,
        start: { dateTime: "2026-11-03T13:00:00-05:00", timeZone: NY },
      },
      wanted,
    );
    expect(moved?.body).toEqual({
      start: wanted.body.start,
      end: wanted.body.end,
    });
  });

  it("keeps guests' answers when the list changes", () => {
    const changes = eventChanges(
      {
        ...asGoogleHasIt,
        attendees: [
          { email: "maya@example.com", organizer: true, self: true },
          { email: "ben@example.com", responseStatus: "accepted" },
          { email: "zoe@example.com", responseStatus: "declined" },
        ],
      },
      wanted,
    );
    expect(changes?.body.attendees).toEqual([
      { email: "maya@example.com", organizer: true, self: true },
      { email: "ben@example.com", responseStatus: "accepted" },
      { email: "ana@example.com" },
    ]);
  });

  it("re-tags an event without emailing anyone", () => {
    const changes = eventChanges(
      {
        ...asGoogleHasIt,
        extendedProperties: {
          private: { faceonMeetingId: meeting.id, faceonEventKey: "old" },
        },
      },
      wanted,
    );
    expect(changes).toEqual({
      body: {
        extendedProperties: {
          private: { faceonMeetingId: meeting.id, faceonEventKey: "rule-1" },
        },
      },
      sendUpdates: "none",
    });
  });

  it("makes a one-off repeat by adding the rule", () => {
    const changes = eventChanges(
      { ...asGoogleHasIt, recurrence: undefined },
      wanted,
    );
    expect(changes?.body.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=TU"]);
  });
});

describe("instanceChanges", () => {
  const instance = (
    original: string,
    patch: Partial<GoogleEvent> = {},
  ): GoogleEvent => ({
    id: `event-1_${original.replace(/[-:]/g, "").replace(".000", "")}`,
    status: "confirmed",
    summary: "Product sync",
    originalStartTime: { dateTime: original, timeZone: NY },
    start: { dateTime: original, timeZone: NY },
    end: {
      dateTime: new Date(Date.parse(original) + 3_600_000).toISOString(),
      timeZone: NY,
    },
    ...patch,
  });
  const instances = [
    instance("2026-11-10T19:00:00.000Z"),
    instance("2026-11-17T19:00:00.000Z"),
    instance("2026-11-24T19:00:00.000Z", { status: "cancelled" }),
  ];
  const change = (
    original: string,
    patch: Partial<
      Parameters<typeof instanceChanges>[0]["exceptions"][number]
    > = {},
  ) => ({
    originalStart: at(original),
    cancelled: false,
    startsAt: null,
    durationMin: null,
    title: null,
    ...patch,
  });

  it("cancels, moves and retitles occurrences as FaceOn says", () => {
    expect(
      instanceChanges({
        rule: weekly,
        title: "Product sync",
        instances,
        exceptions: [
          change("2026-11-10T19:00:00Z", { cancelled: true }),
          change("2026-11-17T19:00:00Z", {
            startsAt: at("2026-11-17T21:00:00Z"),
            title: "Product sync (moved)",
          }),
        ],
      }),
    ).toEqual([
      { kind: "cancel", instanceId: "event-1_20261110T190000Z" },
      {
        kind: "change",
        instanceId: "event-1_20261117T190000Z",
        body: {
          start: { dateTime: "2026-11-17T16:00:00", timeZone: NY },
          end: { dateTime: "2026-11-17T17:00:00", timeZone: NY },
          summary: "Product sync (moved)",
        },
      },
    ]);
  });

  it("leaves occurrences already right, or cancelled in Google", () => {
    expect(
      instanceChanges({
        rule: weekly,
        title: "Product sync",
        instances: [
          instance("2026-11-10T19:00:00.000Z", { status: "cancelled" }),
          ...instances.slice(1),
        ],
        exceptions: [
          change("2026-11-10T19:00:00Z", { cancelled: true }),
          change("2026-11-24T19:00:00Z", {
            startsAt: at("2026-11-24T20:00:00Z"),
          }),
          // Not in Calendar's window: nothing to do.
          change("2027-01-05T19:00:00Z", { cancelled: true }),
        ],
      }),
    ).toEqual([]);
  });
});

describe("currentExceptions and exceptionsWindow", () => {
  const now = at("2026-11-20T12:00:00Z");
  const past = {
    originalStart: at("2026-11-10T19:00:00Z"),
    cancelled: true,
    startsAt: null,
    durationMin: null,
    title: null,
  };
  const movedIntoFuture = {
    ...past,
    cancelled: false,
    startsAt: at("2026-11-21T19:00:00Z"),
  };
  const coming = { ...past, originalStart: at("2026-12-01T19:00:00Z") };

  it("leaves history alone", () => {
    expect(currentExceptions([past, movedIntoFuture, coming], now)).toEqual([
      movedIntoFuture,
      coming,
    ]);
  });

  it("spans every changed occurrence, before and after it moved", () => {
    expect(exceptionsWindow([], 60)).toBeNull();
    expect(exceptionsWindow([movedIntoFuture, coming], 60)).toEqual({
      from: at("2026-11-09T19:00:00Z"),
      to: at("2026-12-02T20:00:00Z"),
    });
  });
});

describe("eventDescription", () => {
  const t = (line: string, values: Record<string, string>) =>
    `${line} ${JSON.stringify(values)}`;

  it("puts the agenda first, then how to join", () => {
    expect(
      eventDescription(t, {
        agenda: "Launch checklist",
        hostName: "Maya",
        appName: "FaceOn",
        link: text.link,
        code: "5843016279",
        passcode: "K7XQ2M",
      }).split("\n"),
    ).toEqual([
      "Launch checklist",
      "",
      'invitation.scheduledIntro {"host":"Maya","appName":"FaceOn"}',
      `invitation.join {"link":"${text.link}"}`,
      'invitation.meetingId {"code":"584 301 6279"}',
      'invitation.passcode {"passcode":"K7XQ2M"}',
    ]);
  });

  it("leaves out what the meeting doesn't have", () => {
    const lines = eventDescription(t, {
      agenda: null,
      hostName: "Maya",
      appName: "FaceOn",
      link: text.link,
      code: "5843016279",
      passcode: null,
    }).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^invitation\.scheduledIntro/);
  });
});

describe("cancellationOnLeaving", () => {
  const none = { rules: [], exceptions: [] };
  const series = (rules: CalendarRule[], exceptions = []) => ({
    rules,
    exceptions,
  });

  it("cancels a one-off meeting that's still to come", () => {
    expect(
      cancellationOnLeaving({
        startsAt: at("2026-11-03T19:00:00Z"),
        series: none,
        now: at("2026-11-02T12:00:00Z"),
      }),
    ).toEqual({ scope: "all", occurrence: null });
  });

  it("leaves a one-off meeting that has happened, or is happening", () => {
    for (const now of ["2026-11-03T19:00:00Z", "2026-11-04T12:00:00Z"]) {
      expect(
        cancellationOnLeaving({
          startsAt: at("2026-11-03T19:00:00Z"),
          series: none,
          now: at(now),
        }),
      ).toBeNull();
    }
  });

  it("ends a series that has met before its next meeting", () => {
    expect(
      cancellationOnLeaving({
        startsAt: null,
        series: series([weekly]),
        now: at("2026-11-12T12:00:00Z"),
      }),
    ).toEqual({ scope: "following", occurrence: at("2026-11-17T19:00:00Z") });
  });

  it("skips a meeting under way: the next one is the first cancelled", () => {
    expect(
      cancellationOnLeaving({
        startsAt: null,
        series: series([weekly]),
        now: at("2026-11-10T19:30:00Z"),
      }),
    ).toEqual({ scope: "following", occurrence: at("2026-11-17T19:00:00Z") });
  });

  it("cancels a series that hasn't met yet, whole", () => {
    expect(
      cancellationOnLeaving({
        startsAt: null,
        series: series([weekly]),
        now: at("2026-11-01T12:00:00Z"),
      }),
    ).toEqual({ scope: "all", occurrence: null });
  });

  it("leaves a series that has ended", () => {
    expect(
      cancellationOnLeaving({
        startsAt: null,
        series: series([{ ...weekly, lastStart: at("2026-11-10T19:00:00Z") }]),
        now: at("2026-11-12T12:00:00Z"),
      }),
    ).toBeNull();
  });
});
