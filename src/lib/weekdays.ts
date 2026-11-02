import { WEEKDAYS, type Weekday } from "@/lib/meetings/recurrence";
import { weekStartsOn } from "@/lib/time";

/** The weekdays in the reader's order: Sunday first in the US, Monday in Europe. */
export function weekdaysInOrder(locale: string): Weekday[] {
  // weekStartsOn: 0 is Sunday; WEEKDAYS starts on Monday.
  const start = (weekStartsOn(locale) + 6) % 7;
  return [...WEEKDAYS.slice(start), ...WEEKDAYS.slice(0, start)];
}

/** A weekday's name in the reader's language: "Tuesday", "Tue" or "T". */
export const weekdayName = (
  day: Weekday,
  locale: string,
  width: "long" | "short" | "narrow",
) =>
  new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
    // 2026-11-02 was a Monday.
    new Date(Date.UTC(2026, 10, 2 + WEEKDAYS.indexOf(day), 12)),
  );
