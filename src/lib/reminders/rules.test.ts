import { describe, expect, it } from "vitest";

import {
  EmailRemindersChoice,
  LOOKBACK_MS,
  readEmailReminders,
  reminderDue,
  startOfUtcDay,
  startWindow,
  withinCap,
} from "./rules";

const at = (iso: string) => new Date(iso);
const MIN = 60_000;

describe("email reminder settings", () => {
  it("keep a known lead time and a real time zone", () => {
    expect(
      readEmailReminders({ minutes: 30, timeZone: "America/New_York" }),
    ).toEqual({ minutes: 30, timeZone: "America/New_York" });
  });

  it("count as off when what's stored isn't valid", () => {
    expect(readEmailReminders(null)).toBeNull();
    expect(
      readEmailReminders({ minutes: 7, timeZone: "America/New_York" }),
    ).toBeNull();
    expect(
      readEmailReminders({ minutes: 30, timeZone: "Mars/Olympus" }),
    ).toBeNull();
  });

  it("take 0 from the settings page as off", () => {
    expect(
      EmailRemindersChoice.safeParse({ minutes: 0, timeZone: "UTC" }).success,
    ).toBe(true);
    expect(
      EmailRemindersChoice.safeParse({ minutes: 45, timeZone: "UTC" }).success,
    ).toBe(false);
  });
});

describe("when a reminder is due", () => {
  const start = at("2026-11-10T15:00:00Z");

  it("is due from its moment, within the lookback", () => {
    expect(reminderDue(start, 10, at("2026-11-10T14:49:59Z"))).toBe(false);
    expect(reminderDue(start, 10, at("2026-11-10T14:50:00Z"))).toBe(true);
    expect(reminderDue(start, 10, at("2026-11-10T14:55:00Z"))).toBe(true);
  });

  it("isn't sent once the meeting has started", () => {
    expect(reminderDue(start, 10, at("2026-11-10T15:00:00Z"))).toBe(false);
  });

  it("lets a missed run catch up, but not long after", () => {
    const dayBefore = 24 * 60;
    expect(reminderDue(start, dayBefore, at("2026-11-09T15:20:00Z"))).toBe(
      true,
    );
    expect(reminderDue(start, dayBefore, at("2026-11-09T15:31:00Z"))).toBe(
      false,
    );
  });

  it("looks at starts that could be due, whatever the lead time", () => {
    const now = at("2026-11-10T14:52:00Z");
    for (const minutes of [10, 30, 60, 1440]) {
      const window = startWindow(minutes, now);
      // Every start whose reminder is due now falls inside the window.
      for (let m = 0; m <= minutes + LOOKBACK_MS / MIN; m++) {
        const candidate = new Date(now.getTime() + m * MIN);
        if (reminderDue(candidate, minutes, now)) {
          expect(candidate >= window.from && candidate <= window.to).toBe(true);
        }
      }
    }
  });
});

describe("the daily cap", () => {
  const due = [
    { id: "late", start: at("2026-11-10T16:00:00Z") },
    { id: "soon", start: at("2026-11-10T15:00:00Z") },
    { id: "middle", start: at("2026-11-10T15:30:00Z") },
  ];

  it("sends the soonest first, as many as the day allows", () => {
    expect(withinCap(due, 50, 48)).toEqual({
      send: [due[1], due[2]],
      held: 1,
    });
  });

  it("holds everything once the day's emails are used", () => {
    expect(withinCap(due, 50, 50)).toEqual({ send: [], held: 3 });
    expect(withinCap(due, 50, 60)).toEqual({ send: [], held: 3 });
  });

  it("counts the day from midnight UTC", () => {
    expect(startOfUtcDay(at("2026-11-10T23:59:00-05:00"))).toEqual(
      at("2026-11-11T00:00:00Z"),
    );
  });
});
