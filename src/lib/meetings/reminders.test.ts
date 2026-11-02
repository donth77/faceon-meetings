import { describe, expect, it } from "vitest";

import { reminderKey, remindersDue, staleReminders } from "./reminders";

describe("staleReminders", () => {
  const sync = { code: "1234567890", start: "2026-11-02T23:30:00.000Z" };

  it("keeps a reminder while its meeting is still coming up", () => {
    expect(staleReminders([reminderKey(sync)], [sync])).toEqual([]);
  });

  it("takes back a reminder whose meeting was deleted or moved", () => {
    const moved = { ...sync, start: "2026-11-03T00:00:00.000Z" };
    expect(staleReminders([reminderKey(sync)], [])).toEqual([
      reminderKey(sync),
    ]);
    expect(staleReminders([reminderKey(sync)], [moved])).toEqual([
      reminderKey(sync),
    ]);
  });
});

describe("remindersDue", () => {
  const NOW = Date.parse("2026-11-02T23:29:00Z");
  const at = (minutesFromNow: number) => ({
    code: "1234567890",
    start: new Date(NOW + minutesFromNow * 60_000).toISOString(),
  });
  const due = (
    rows: Array<{ code: string; start: string }>,
    late: (row: { code: string; start: string }) => boolean = () => true,
  ) =>
    remindersDue({
      rows,
      now: NOW,
      minutes: 5,
      horizon: 11 * 60_000,
      late,
    }).map(({ row, wait }) => [reminderKey(row), wait / 60_000]);

  it("sets each reminder for its time, up to the next look", () => {
    expect(due([at(15)])).toEqual([[reminderKey(at(15)), 10]]);
    expect(due([at(30)])).toEqual([]);
  });

  it("shows a reminder whose time has passed at once, when FaceOn was opened late", () => {
    expect(due([at(2)])).toEqual([[reminderKey(at(2)), 0]]);
  });

  it("skips it for a meeting just scheduled or moved here", () => {
    expect(due([at(2)], () => false)).toEqual([]);
    expect(due([at(15)], () => false)).toEqual([[reminderKey(at(15)), 10]]);
  });

  it("never reminds of a meeting that has started", () => {
    expect(due([at(-1), at(0)])).toEqual([]);
  });
});
