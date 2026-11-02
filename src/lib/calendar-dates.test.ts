import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  dayOf,
  daysOf,
  lanesOf,
  minutesOfDay,
  sameMonth,
  spanOf,
  weekdayOf,
  weekStart,
} from "./calendar-dates";

describe("days in a zone", () => {
  // 2026-11-03 02:30 UTC is still the 2nd in New York and already the 3rd in Tokyo.
  const instant = new Date("2026-11-03T02:30:00Z");

  it("puts an instant on the zone's day", () => {
    expect(dayOf(instant, "America/New_York")).toBe("2026-11-02");
    expect(dayOf(instant, "Asia/Tokyo")).toBe("2026-11-03");
  });

  it("measures minutes from the zone's midnight", () => {
    expect(minutesOfDay(instant, "America/New_York")).toBe(21 * 60 + 30);
    expect(minutesOfDay(instant, "Asia/Tokyo")).toBe(11 * 60 + 30);
  });

  it("covers a run of days from midnight to midnight in the zone", () => {
    const span = spanOf(["2026-11-02", "2026-11-03"], "America/New_York");
    expect(span.from.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(span.to.toISOString()).toBe("2026-11-04T05:00:00.000Z");
  });
});

describe("day arithmetic", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("moves by months to the first of the month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("knows weekdays and where weeks start", () => {
    expect(weekdayOf("2026-11-01")).toBe(0); // a Sunday
    expect(weekStart("2026-11-04", 0)).toBe("2026-11-01");
    expect(weekStart("2026-11-04", 1)).toBe("2026-11-02");
    expect(weekStart("2026-11-01", 1)).toBe("2026-10-26");
  });

  it("compares months", () => {
    expect(sameMonth("2026-11-01", "2026-11-30")).toBe(true);
    expect(sameMonth("2026-11-30", "2026-12-01")).toBe(false);
  });
});

describe("daysOf", () => {
  it("shows whole weeks around a month", () => {
    const days = daysOf("month", "2026-11-17", 0);
    expect(days[0]).toBe("2026-11-01");
    expect(days.at(-1)).toBe("2026-12-05");
    expect(days.length % 7).toBe(0);
  });

  it("starts the weeks on Monday where weeks start then", () => {
    const days = daysOf("month", "2026-11-17", 1);
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
  });

  it("shows one week", () => {
    expect(daysOf("week", "2026-11-04", 0)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
  });
});

describe("lanesOf", () => {
  const row = (start: string, end: string) => ({
    start: `2026-11-02T${start}:00Z`,
    end: `2026-11-02T${end}:00Z`,
  });

  it("puts overlapping meetings side by side", () => {
    const a = row("09:00", "10:00");
    const b = row("09:30", "10:30");
    const c = row("11:00", "11:30");
    const lanes = lanesOf([c, b, a]);
    expect(lanes.get(a)).toEqual({ lane: 0, of: 2 });
    expect(lanes.get(b)).toEqual({ lane: 1, of: 2 });
    expect(lanes.get(c)).toEqual({ lane: 0, of: 1 });
  });

  it("reuses a lane once it's free", () => {
    const a = row("09:00", "10:00");
    const b = row("09:00", "09:30");
    const c = row("09:30", "10:00");
    const lanes = lanesOf([a, b, c]);
    expect(lanes.get(c)).toEqual({ lane: 1, of: 2 });
  });
});
