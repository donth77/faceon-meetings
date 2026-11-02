import { describe, expect, it } from "vitest";

import { reminderKey, staleReminders } from "./reminders";

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
