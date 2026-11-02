import { localParts, zonedToUtc } from "@/lib/time";

/**
 * Calendar arithmetic on days in the viewer's time zone (Settings → General), which
 * may not be the device's. A day is its local date, "YYYY-MM-DD": the calendar's
 * cells, today and each meeting's day are all worked out in that zone.
 */
export type DayKey = string;

const DAY_MS = 86_400_000;

/** Noon UTC on the day: an instant that formats as that date with timeZone "UTC". */
export function dayAsDate(day: DayKey): Date {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

const keyOf = (date: Date): DayKey => date.toISOString().slice(0, 10);

/** The day an instant falls on in a zone. */
export const dayOf = (instant: Date, timeZone: string): DayKey =>
  localParts(instant, timeZone).date;

export const addDays = (day: DayKey, days: number): DayKey =>
  keyOf(new Date(dayAsDate(day).getTime() + days * DAY_MS));

/** The first day of the month `months` away from the day's month. */
export function addMonths(day: DayKey, months: number): DayKey {
  const date = dayAsDate(day);
  return keyOf(
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12),
    ),
  );
}

/** 0 for Sunday … 6 for Saturday. */
export const weekdayOf = (day: DayKey): number => dayAsDate(day).getUTCDay();

/** The first day of the day's week, weeks starting on `first` (0 is Sunday). */
export const weekStart = (day: DayKey, first: number): DayKey =>
  addDays(day, -((weekdayOf(day) - first + 7) % 7));

export const sameMonth = (a: DayKey, b: DayKey) =>
  a.slice(0, 7) === b.slice(0, 7);

/** The days a view shows: the whole weeks around the day's month, or the day's week. */
export function daysOf(
  mode: "month" | "week",
  anchor: DayKey,
  first: number,
): DayKey[] {
  if (mode === "week") {
    const start = weekStart(anchor, first);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const start = weekStart(addMonths(anchor, 0), first);
  const lastDay = addDays(addMonths(anchor, 1), -1);
  const end = addDays(weekStart(lastDay, first), 6);
  const count =
    Math.round(
      (dayAsDate(end).getTime() - dayAsDate(start).getTime()) / DAY_MS,
    ) + 1;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** The moments a run of days covers in a zone: from its first midnight to the next. */
export function spanOf(
  days: DayKey[],
  timeZone: string,
): { from: Date; to: Date } {
  const first = days[0] ?? "1970-01-01";
  const last = days.at(-1) ?? first;
  return {
    from: zonedToUtc(`${first}T00:00`, timeZone),
    to: zonedToUtc(`${addDays(last, 1)}T00:00`, timeZone),
  };
}

/** Minutes since the local midnight in a zone, for placing a meeting in a day. */
export function minutesOfDay(instant: Date, timeZone: string): number {
  const [hours = 0, minutes = 0] = localParts(instant, timeZone)
    .time.split(":")
    .map(Number);
  return hours * 60 + minutes;
}

/** Lanes for overlapping meetings in one day, so they sit side by side. */
export function lanesOf<T extends { start: string; end: string }>(
  rows: T[],
): Map<T, { lane: number; of: number }> {
  const sorted = [...rows].sort((a, b) => a.start.localeCompare(b.start));
  const result = new Map<T, { lane: number; of: number }>();
  let group: T[] = [];
  let groupEnd = 0;
  const flush = () => {
    const ends: number[] = [];
    for (const row of group) {
      const start = new Date(row.start).getTime();
      let lane = ends.findIndex((end) => end <= start);
      if (lane === -1) lane = ends.length;
      ends[lane] = new Date(row.end).getTime();
      result.set(row, { lane, of: 0 });
    }
    for (const row of group) {
      const entry = result.get(row);
      if (entry) entry.of = ends.length;
    }
    group = [];
  };
  for (const row of sorted) {
    const start = new Date(row.start).getTime();
    if (group.length > 0 && start >= groupEnd) flush();
    group.push(row);
    groupEnd = Math.max(groupEnd, new Date(row.end).getTime());
  }
  flush();
  return result;
}
