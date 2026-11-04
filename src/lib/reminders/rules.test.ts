import { describe, expect, it } from "vitest";

import {
  EMAIL_REMINDER_MINUTES,
  EmailRemindersChoice,
  HORIZON_MS,
  inHorizon,
  planReminders,
  readEmailReminders,
  sendTime,
  SETTLED_MS,
  startOfUtcDay,
  startWindow,
  type ScheduledReminder,
  type WantedReminder,
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

describe("which reminders are scheduled now", () => {
  const now = at("2026-11-10T12:00:00Z");
  const later = (ms: number) => new Date(now.getTime() + ms);

  it("goes its lead time before the start", () => {
    expect(sendTime(at("2026-11-10T15:00:00Z"), 10)).toEqual(
      at("2026-11-10T14:50:00Z"),
    );
    expect(sendTime(at("2026-11-10T15:00:00Z"), 1440)).toEqual(
      at("2026-11-09T15:00:00Z"),
    );
  });

  it("is scheduled once it goes within the horizon", () => {
    expect(inHorizon(later(HORIZON_MS), now)).toBe(true);
    expect(inHorizon(later(HORIZON_MS + 1), now)).toBe(false);
  });

  it("isn't scheduled when it would go any moment, or should have gone", () => {
    expect(inHorizon(later(SETTLED_MS + 1), now)).toBe(true);
    expect(inHorizon(later(SETTLED_MS), now)).toBe(false);
    expect(inHorizon(later(-MIN), now)).toBe(false);
  });

  it("looks at every start whose reminder could be in the horizon", () => {
    for (const minutes of EMAIL_REMINDER_MINUTES) {
      const window = startWindow(minutes, now);
      for (const offset of [
        SETTLED_MS - MIN,
        SETTLED_MS + MIN,
        HORIZON_MS / 2,
        HORIZON_MS,
        HORIZON_MS + MIN,
      ]) {
        const start = later(offset + minutes * MIN);
        const looked = start >= window.from && start <= window.to;
        expect(looked).toBe(inHorizon(sendTime(start, minutes), now));
      }
    }
  });
});

describe("bringing scheduled reminders in line", () => {
  const now = at("2026-11-10T12:00:00Z");
  const want = (key: string, sendAt: string, fingerprint = "v1") => ({
    key,
    sendAt: at(sendAt),
    fingerprint,
  });
  const row = (
    key: string,
    sendAt: string | null,
    fingerprint: string | null = "v1",
    emailId: string | null = `email-${key}`,
  ) => ({ key, sendAt: sendAt ? at(sendAt) : null, emailId, fingerprint });
  const plan = (
    wanted: WantedReminder[],
    scheduled: ScheduledReminder[],
    perDay = new Map<number, number>(),
    cap = 50,
  ) => planReminders({ wanted, scheduled, now, cap, perDay });
  const day = (iso: string) => at(iso).getTime();

  it("schedules what's wanted and not scheduled yet", () => {
    const a = want("a", "2026-11-10T14:50:00Z");
    expect(plan([a], [])).toMatchObject({
      cancel: [],
      resume: [],
      schedule: [a],
      held: 0,
    });
  });

  it("leaves alone what's already scheduled as wanted", () => {
    const result = plan(
      [want("a", "2026-11-10T14:50:00Z")],
      [row("a", "2026-11-10T14:50:00Z")],
    );
    expect(result).toMatchObject({ cancel: [], resume: [], schedule: [] });
  });

  it("cancels what's no longer wanted", () => {
    const old = row("a", "2026-11-10T14:50:00Z");
    expect(plan([], [old])).toMatchObject({ cancel: [old], schedule: [] });
  });

  it("replaces one whose email or time changed", () => {
    const old = row("a", "2026-11-10T14:50:00Z");
    const retitled = want("a", "2026-11-10T14:50:00Z", "v2");
    expect(plan([retitled], [old])).toMatchObject({
      cancel: [old],
      schedule: [retitled],
    });
    const earlier = want("a", "2026-11-10T14:30:00Z");
    expect(plan([earlier], [old])).toMatchObject({
      cancel: [old],
      schedule: [earlier],
    });
  });

  it("never touches one that's gone or about to go, or sends it twice", () => {
    const going = row("a", "2026-11-10T12:01:00Z");
    const changed = want("a", "2026-11-10T12:01:00Z", "v2");
    expect(plan([changed], [going])).toMatchObject({
      cancel: [],
      schedule: [],
    });
    expect(plan([], [going])).toMatchObject({ cancel: [], schedule: [] });
  });

  it("counts rows from before reminders were scheduled as sent", () => {
    const sent = row("a", null, null, null);
    expect(plan([want("a", "2026-11-10T14:50:00Z")], [sent])).toMatchObject({
      cancel: [],
      resume: [],
      schedule: [],
    });
  });

  it("finishes one whose scheduling was cut short", () => {
    const cut = row("a", "2026-11-10T14:50:00Z", "v1", null);
    expect(plan([want("a", "2026-11-10T14:50:00Z")], [cut])).toMatchObject({
      cancel: [],
      resume: [cut],
      schedule: [],
    });
  });

  it("keeps each day within the cap, soonest first", () => {
    const today = day("2026-11-10T00:00:00Z");
    const wanted = [
      want("late", "2026-11-10T20:00:00Z"),
      want("soon", "2026-11-10T13:00:00Z"),
      want("middle", "2026-11-10T16:00:00Z"),
      want("tomorrow", "2026-11-11T09:00:00Z"),
    ];
    const result = plan(wanted, [], new Map([[today, 48]]));
    expect(result.schedule.map((w) => w.key)).toEqual([
      "soon",
      "middle",
      "tomorrow",
    ]);
    expect(result.held).toBe(1);
    expect(result.perDay.get(today)).toBe(50);
    expect(result.perDay.get(day("2026-11-11T00:00:00Z"))).toBe(1);
  });

  it("gives a cancelled reminder's place on its day to another", () => {
    const today = day("2026-11-10T00:00:00Z");
    const old = row("old", "2026-11-10T14:50:00Z");
    const next = want("next", "2026-11-10T15:50:00Z");
    const result = plan([next], [old], new Map([[today, 50]]));
    expect(result).toMatchObject({ cancel: [old], schedule: [next], held: 0 });
    expect(result.perDay.get(today)).toBe(50);
  });

  it("counts the day from midnight UTC", () => {
    expect(startOfUtcDay(at("2026-11-10T23:59:00-05:00"))).toEqual(
      at("2026-11-11T00:00:00Z"),
    );
  });
});
