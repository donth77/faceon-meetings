/**
 * Repeating meetings, as the schedule form builds them and the server stores them (an
 * RFC 5545 rule, expanded in the meeting's time zone). Safe to import in the browser.
 */
import { z } from "zod";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export const Weekday = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof Weekday>;

/** A local calendar date, "YYYY-MM-DD". */
const LocalDate = z.iso.date();

export const RecurrenceEnd = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("never") }),
  /** Through this local date, inclusive. */
  z.object({ kind: z.literal("on"), date: LocalDate }),
  z.object({
    kind: z.literal("after"),
    count: z.number().int().min(1).max(730),
  }),
]);
export type RecurrenceEnd = z.infer<typeof RecurrenceEnd>;

export const Recurrence = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(99),
  /** Weekly: on these days (the start's own day when empty). */
  byDay: z.array(Weekday).max(7).optional(),
  /** Monthly: the same date, the same weekday (the first Tuesday), or the last such weekday. */
  monthly: z.enum(["date", "weekday", "lastWeekday"]).optional(),
  end: RecurrenceEnd,
});
export type Recurrence = z.infer<typeof Recurrence>;

/** What a start date says about itself, for presets and labels. */
export type StartFacts = {
  weekday: Weekday;
  /** Day of the month, 1–31. */
  day: number;
  month: number;
  /** Which of its weekday in the month it is: 1 for the first Tuesday. */
  nth: number;
  /** It's the last such weekday of its month. */
  isLast: boolean;
};

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** A series ends at most this long after it starts, so its meetings stay countable. */
export const MAX_SERIES_YEARS = 5;

/** The latest end date ("YYYY-MM-DD") for a series starting on this local date. */
export function latestSeriesEnd(startDate: string): string {
  const [year = 1970, month = 1, day = 1] = startDate
    .slice(0, 10)
    .split("-")
    .map(Number);
  const endYear = year + MAX_SERIES_YEARS;
  const endDay = Math.min(day, daysInMonth(endYear, month));
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, "0");
  return `${pad(endYear, 4)}-${pad(month)}-${pad(endDay)}`;
}

/** Facts about a local date, "YYYY-MM-DD". */
export function startFacts(localDate: string): StartFacts {
  const [year = 1970, month = 1, day = 1] = localDate
    .slice(0, 10)
    .split("-")
    .map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    weekday: WEEKDAYS[(sundayFirst + 6) % 7] ?? "MO",
    day,
    month,
    nth: Math.ceil(day / 7),
    isLast: day + 7 > daysInMonth(year, month),
  };
}

export const REPEAT_PRESETS = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "weekdays",
] as const;
export type RepeatPreset = (typeof REPEAT_PRESETS)[number];

const NEVER = { kind: "never" } as const;
const WORKWEEK: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];

/** The Repeat menu's choices, worked out from the chosen day, as Google Calendar does. */
export function presetRecurrence(
  preset: RepeatPreset,
  facts: StartFacts,
): Recurrence | null {
  switch (preset) {
    case "none":
      return null;
    case "daily":
      return { freq: "DAILY", interval: 1, end: NEVER };
    case "weekly":
      return {
        freq: "WEEKLY",
        interval: 1,
        byDay: [facts.weekday],
        end: NEVER,
      };
    case "monthly":
      return {
        freq: "MONTHLY",
        interval: 1,
        // The fifth Tuesday doesn't happen every month; the last one does.
        monthly: facts.nth === 5 ? "lastWeekday" : "weekday",
        end: NEVER,
      };
    case "yearly":
      return { freq: "YEARLY", interval: 1, end: NEVER };
    case "weekdays":
      return { freq: "WEEKLY", interval: 1, byDay: WORKWEEK, end: NEVER };
  }
}

const sameDays = (a: readonly Weekday[], b: readonly Weekday[]) =>
  a.length === b.length && a.every((day) => b.includes(day));

/** Which Repeat menu choice a recurrence is, or "custom". */
export function presetOf(
  recurrence: Recurrence | null,
  facts: StartFacts,
): RepeatPreset | "custom" {
  if (!recurrence) return "none";
  const match = REPEAT_PRESETS.find((preset) => {
    const candidate = presetRecurrence(preset, facts);
    if (!candidate) return false;
    return (
      candidate.freq === recurrence.freq &&
      candidate.interval === recurrence.interval &&
      sameDays(candidate.byDay ?? [], recurrence.byDay ?? []) &&
      (candidate.monthly ?? "weekday") === (recurrence.monthly ?? "weekday") &&
      recurrence.end.kind === "never"
    );
  });
  return match ?? "custom";
}

/**
 * The RFC 5545 RRULE for a recurrence starting on a day with these facts. UNTIL, when
 * the series ends on a date, is that date's last moment in UTC ("20270331T235959Z").
 */
export function toRRule(
  recurrence: Recurrence,
  facts: StartFacts,
  untilUtc: string | null,
): string {
  const parts = [`FREQ=${recurrence.freq}`];
  if (recurrence.interval > 1) parts.push(`INTERVAL=${recurrence.interval}`);
  if (recurrence.freq === "WEEKLY") {
    const days = recurrence.byDay?.length ? recurrence.byDay : [facts.weekday];
    const ordered = WEEKDAYS.filter((day) => days.includes(day));
    parts.push(`BYDAY=${ordered.join(",")}`);
  }
  if (recurrence.freq === "MONTHLY") {
    const mode = recurrence.monthly ?? "date";
    if (mode === "date") parts.push(`BYMONTHDAY=${facts.day}`);
    else if (mode === "weekday")
      parts.push(`BYDAY=${facts.nth}${facts.weekday}`);
    else parts.push(`BYDAY=-1${facts.weekday}`);
  }
  if (recurrence.end.kind === "after") {
    parts.push(`COUNT=${recurrence.end.count}`);
  } else if (recurrence.end.kind === "on" && untilUtc) {
    parts.push(`UNTIL=${untilUtc}`);
  }
  return parts.join(";");
}
