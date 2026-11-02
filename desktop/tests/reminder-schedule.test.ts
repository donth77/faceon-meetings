import { describe, expect, it } from "vitest";

import { dueReminders, nextMeeting } from "../src/main/reminder-schedule";

const at = (iso: string) => Date.parse(iso);
const standup = {
  id: "m1",
  title: "Standup",
  startsAt: "2026-11-03T09:00:00Z",
  path: "/j/1234567890",
};
const review = {
  id: "m2",
  title: "Design review",
  startsAt: "2026-11-03T15:00:00Z",
  path: "/j/2234567890",
};

describe("dueReminders", () => {
  it("reminds within the chosen minutes, before the start, once", () => {
    const now = at("2026-11-03T08:55:00Z");
    expect(dueReminders([standup, review], 5, now, new Set())).toEqual([
      { key: "m1@2026-11-03T09:00:00Z", meeting: standup },
    ]);
    expect(
      dueReminders([standup], 5, now, new Set(["m1@2026-11-03T09:00:00Z"])),
    ).toEqual([]);
  });

  it("says nothing too early, after the start, or when reminders are off", () => {
    expect(
      dueReminders([standup], 5, at("2026-11-03T08:50:00Z"), new Set()),
    ).toEqual([]);
    expect(
      dueReminders([standup], 5, at("2026-11-03T09:00:00Z"), new Set()),
    ).toEqual([]);
    expect(
      dueReminders([standup], 0, at("2026-11-03T08:58:00Z"), new Set()),
    ).toEqual([]);
  });
});

describe("nextMeeting", () => {
  it("is the soonest not long started", () => {
    expect(nextMeeting([review, standup], at("2026-11-03T08:00:00Z"))).toBe(
      standup,
    );
    expect(nextMeeting([review, standup], at("2026-11-03T09:10:00Z"))).toBe(
      review,
    );
    expect(nextMeeting([], 0)).toBeNull();
  });
});
