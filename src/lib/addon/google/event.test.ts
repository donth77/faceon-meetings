import { describe, expect, it } from "vitest";

import { followable, scheduleOfEvent } from "./event";

describe("scheduleOfEvent", () => {
  it("takes a one-off event's local start, zone, length and title", () => {
    expect(
      scheduleOfEvent({
        title: "  Design review ",
        start: "2026-11-10T15:00:00Z",
        end: "2026-11-10T15:45:00Z",
        timeZone: "America/New_York",
      }),
    ).toEqual({
      title: "Design review",
      timed: {
        start: "2026-11-10T10:00",
        timeZone: "America/New_York",
        durationMin: 45,
        recurrence: null,
      },
    });
  });

  it("falls back to the calendar's zone, keeps lengths within FaceOn's, and takes all-day events", () => {
    const short = scheduleOfEvent(
      {
        start: "2026-11-10T09:00:00Z",
        end: "2026-11-10T09:01:00Z",
        timeZone: "Nowhere/Land",
      },
      "Europe/Berlin",
    );
    expect(short.timed).toMatchObject({
      timeZone: "Europe/Berlin",
      durationMin: 5,
    });
    expect(short.title).toBeNull();
    const allDay = scheduleOfEvent({
      start: "2026-11-12T00:00:00Z",
      end: "2026-11-14T00:00:00Z",
      allDay: true,
      timeZone: "Asia/Tokyo",
    });
    expect(allDay.timed).toMatchObject({
      start: "2026-11-12T00:00",
      durationMin: 1440,
    });
  });

  it("follows weekly, monthly and daily repeats it can say exactly", () => {
    const weekly = scheduleOfEvent({
      start: "2026-11-10T15:00:00Z",
      end: "2026-11-10T15:30:00Z",
      timeZone: "UTC",
      recurrence: [
        "RRULE:FREQ=WEEKLY;WKST=SU;BYDAY=TU,TH",
        "EXDATE;TZID=UTC:20261117T150000",
      ],
    });
    expect(weekly.timed?.recurrence).toEqual({
      freq: "WEEKLY",
      interval: 1,
      byDay: ["TU", "TH"],
      end: { kind: "never" },
    });
    expect(
      scheduleOfEvent({
        start: "2026-11-10T15:00:00Z",
        end: "2026-11-10T15:30:00Z",
        timeZone: "UTC",
        recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6"],
      }).timed?.recurrence,
    ).toMatchObject({
      freq: "WEEKLY",
      interval: 2,
      end: { kind: "after", count: 6 },
    });
    // The second Tuesday of each month, starting on a second Tuesday.
    expect(
      followable("FREQ=MONTHLY;BYDAY=2TU", "2026-11-10", "UTC"),
    ).toMatchObject({
      monthly: "weekday",
    });
    expect(
      followable("FREQ=DAILY;UNTIL=20261130T235959Z", "2026-11-10", "UTC"),
    ).toMatchObject({
      freq: "DAILY",
      end: { kind: "on" },
    });
  });

  it("gives no fixed time to repeats FaceOn can't say exactly", () => {
    const odd = (rule: string) =>
      scheduleOfEvent({
        start: "2026-11-10T15:00:00Z",
        end: "2026-11-10T15:30:00Z",
        timeZone: "UTC",
        recurrence: [rule],
      });
    // The 3rd of each month, though the event starts on the 10th.
    expect(odd("RRULE:FREQ=MONTHLY;BYMONTHDAY=3").timed).toBeNull();
    expect(odd("RRULE:FREQ=MONTHLY;BYDAY=TU;BYSETPOS=-2").timed).toBeNull();
    expect(odd("RRULE:FREQ=YEARLY;BYMONTH=3").timed).toBeNull();
    expect(odd("RRULE:FREQ=HOURLY").timed).toBeNull();
    expect(odd("RRULE:FREQ=DAILY;COUNT=5000").timed).toBeNull();
    expect(odd("RDATE:20261201T150000Z").timed).toBeNull();
    // The title still comes through.
    expect(
      scheduleOfEvent({
        title: "Odd",
        start: "2026-11-10T15:00:00Z",
        end: "2026-11-10T15:30:00Z",
        recurrence: ["RRULE:FREQ=WEEKLY", "RRULE:FREQ=MONTHLY"],
      }),
    ).toEqual({ title: "Odd", timed: null });
  });
});
