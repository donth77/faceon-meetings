import { describe, expect, it } from "vitest";

import { liveOccurrenceKeys, occurrenceKey, worthWatching } from "./live";

const now = new Date("2026-11-04T15:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const HOUR = 60;
const DAY = 24 * HOUR;

/** A weekly meeting's occurrences, an hour long, starting `offsets` minutes from now. */
const weekly = (code: string, ...offsets: number[]) =>
  offsets.map((offset) => ({
    code,
    start: at(offset),
    end: at(offset + HOUR),
    originalStart: at(offset),
  }));

describe("liveOccurrenceKeys", () => {
  it("marks the occurrence under way, not the series' others", () => {
    const rows = weekly("1234567890", -30, 7 * DAY - 30);
    expect(liveOccurrenceKeys(rows, new Set(["1234567890"]), now)).toEqual(
      new Set([occurrenceKey("1234567890", at(-30))]),
    );
  });

  it("marks the one that ran over, or the one started early", () => {
    const ranOver = weekly("1111111111", -90, 7 * DAY - 90);
    expect(liveOccurrenceKeys(ranOver, new Set(["1111111111"]), now)).toEqual(
      new Set([occurrenceKey("1111111111", at(-90))]),
    );

    const early = weekly("2222222222", -DAY, 10);
    expect(liveOccurrenceKeys(early, new Set(["2222222222"]), now)).toEqual(
      new Set([occurrenceKey("2222222222", at(10))]),
    );
  });

  it("follows a moved occurrence by when it now happens", () => {
    const moved = {
      code: "3333333333",
      start: at(-15),
      end: at(45),
      originalStart: at(2 * DAY),
    };
    expect(liveOccurrenceKeys([moved], new Set(["3333333333"]), now)).toEqual(
      new Set([occurrenceKey("3333333333", at(2 * DAY))]),
    );
  });

  it("marks only meetings that are live, one occurrence each", () => {
    const rows = [
      ...weekly("1234567890", -30),
      ...weekly("9876543210", -20),
      ...weekly("5555555555", 3 * HOUR),
    ];
    expect(
      liveOccurrenceKeys(rows, new Set(["9876543210", "4444444444"]), now),
    ).toEqual(new Set([occurrenceKey("9876543210", at(-20))]));
    expect(liveOccurrenceKeys(rows, new Set(), now)).toEqual(new Set());
  });
});

describe("worthWatching", () => {
  const row = (startMinutes: number, live = false) => ({
    start: at(startMinutes).toISOString(),
    end: at(startMinutes + HOUR).toISOString(),
    live,
  });

  it("watches while a meeting is live, even past its scheduled end", () => {
    expect(worthWatching([row(-3 * HOUR, true)], now.getTime())).toBe(true);
  });

  it("watches from ten minutes before a meeting starts until it ends", () => {
    expect(worthWatching([row(10)], now.getTime())).toBe(true);
    expect(worthWatching([row(11)], now.getTime())).toBe(false);
    expect(worthWatching([row(-30)], now.getTime())).toBe(true);
    expect(worthWatching([row(-HOUR)], now.getTime())).toBe(false);
  });

  it("doesn't watch an empty page", () => {
    expect(worthWatching([], now.getTime())).toBe(false);
  });
});
