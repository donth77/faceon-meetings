import { describe, expect, it } from "vitest";

import {
  lastStartOf,
  localDateTime,
  occurrencesBetween,
  untilUtc,
  zonedInstant,
} from "./occurrences";
import {
  latestSeriesEnd,
  presetOf,
  presetRecurrence,
  startFacts,
  toRRule,
  type Recurrence,
} from "./recurrence";

const NY = "America/New_York";

describe("startFacts", () => {
  it("knows the weekday and which of the month it is", () => {
    expect(startFacts("2026-11-03")).toEqual({
      weekday: "TU",
      day: 3,
      month: 11,
      nth: 1,
      isLast: false,
    });
    expect(startFacts("2026-11-24")).toMatchObject({ nth: 4, isLast: true });
  });
});

describe("toRRule", () => {
  const facts = startFacts("2026-11-03"); // the first Tuesday
  const weekly: Recurrence = {
    freq: "WEEKLY",
    interval: 1,
    byDay: ["TH", "TU"],
    end: { kind: "on", date: "2027-03-31" },
  };

  it("writes weekly days in order, and UNTIL in UTC", () => {
    expect(toRRule(weekly, facts, untilUtc("2027-03-31", NY))).toBe(
      "FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20270401T035959Z",
    );
  });

  it("writes monthly by date, by weekday and by last weekday", () => {
    const monthly = (mode: Recurrence["monthly"]): Recurrence => ({
      freq: "MONTHLY",
      interval: 2,
      monthly: mode,
      end: { kind: "after", count: 6 },
    });
    expect(toRRule(monthly("date"), facts, null)).toBe(
      "FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=3;COUNT=6",
    );
    expect(toRRule(monthly("weekday"), facts, null)).toBe(
      "FREQ=MONTHLY;INTERVAL=2;BYDAY=1TU;COUNT=6",
    );
    expect(toRRule(monthly("lastWeekday"), facts, null)).toBe(
      "FREQ=MONTHLY;INTERVAL=2;BYDAY=-1TU;COUNT=6",
    );
  });
});

describe("presets", () => {
  const facts = startFacts("2026-11-03");

  it("round-trips each preset", () => {
    for (const preset of [
      "none",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "weekdays",
    ] as const) {
      expect(presetOf(presetRecurrence(preset, facts), facts)).toBe(preset);
    }
  });

  it("calls anything else custom", () => {
    expect(
      presetOf(
        { freq: "WEEKLY", interval: 2, byDay: ["TU"], end: { kind: "never" } },
        facts,
      ),
    ).toBe("custom");
  });

  it("uses the last weekday when the day is the fifth of its kind", () => {
    expect(presetRecurrence("monthly", startFacts("2026-12-29"))?.monthly).toBe(
      "lastWeekday",
    );
  });
});

describe("occurrences", () => {
  // Weekly on Tuesday at 10:00 New York time, across the November DST change.
  const first = zonedInstant("2026-10-27T10:00", NY);
  const rule = {
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    firstStart: first,
    lastStart: null,
    durationMin: 30,
    timeZone: NY,
  };

  it("keeps the local time across a daylight-saving change", () => {
    const found = occurrencesBetween({
      rules: [rule],
      exceptions: [],
      from: first,
      to: zonedInstant("2026-11-12T00:00", NY),
    });
    expect(found.map((o) => localDateTime(o.start, NY))).toEqual([
      "2026-10-27T10:00",
      "2026-11-03T10:00",
      "2026-11-10T10:00",
    ]);
    // 14:00 UTC before the change, 15:00 UTC after it.
    expect(found[0]?.start.toISOString()).toBe("2026-10-27T14:00:00.000Z");
    expect(found[1]?.start.toISOString()).toBe("2026-11-03T15:00:00.000Z");
  });

  it("drops a cancelled occurrence and moves a moved one", () => {
    const second = zonedInstant("2026-11-03T10:00", NY);
    const third = zonedInstant("2026-11-10T10:00", NY);
    const found = occurrencesBetween({
      rules: [rule],
      exceptions: [
        {
          originalStart: second,
          cancelled: true,
          startsAt: null,
          durationMin: null,
          title: null,
        },
        {
          originalStart: third,
          cancelled: false,
          startsAt: zonedInstant("2026-11-10T15:00", NY),
          durationMin: 60,
          title: "Planning",
        },
      ],
      from: first,
      to: zonedInstant("2026-11-12T00:00", NY),
    });
    expect(found).toHaveLength(2);
    expect(found[1]).toMatchObject({ moved: true, title: "Planning" });
    expect(localDateTime(found[1]!.start, NY)).toBe("2026-11-10T15:00");
    expect(found[1]!.originalStart.getTime()).toBe(third.getTime());
  });

  it("includes a meeting already under way at the start of the window", () => {
    const found = occurrencesBetween({
      rules: [rule],
      exceptions: [],
      from: new Date(first.getTime() + 10 * 60_000),
      to: new Date(first.getTime() + 60 * 60_000),
    });
    expect(found).toHaveLength(1);
  });

  it("finds a series' last meeting, or none when it repeats forever", () => {
    expect(lastStartOf(rule)).toBeNull();
    const counted = { ...rule, rrule: "FREQ=WEEKLY;BYDAY=TU;COUNT=3" };
    expect(lastStartOf(counted)?.toISOString()).toBe(
      "2026-11-10T15:00:00.000Z",
    );
  });

  it("treats a series too long to count as one that repeats forever", () => {
    // Saved before end dates were capped: daily for over 30 years.
    const daily = {
      ...rule,
      rrule: `FREQ=DAILY;UNTIL=${untilUtc("2060-01-01", NY)}`,
    };
    expect(lastStartOf(daily)).toBeNull();
  });
});

describe("latestSeriesEnd", () => {
  it("lets a repeating meeting run five years", () => {
    expect(latestSeriesEnd("2026-11-02")).toBe("2031-11-02");
    expect(latestSeriesEnd("2028-02-29")).toBe("2033-02-28");
  });
});
