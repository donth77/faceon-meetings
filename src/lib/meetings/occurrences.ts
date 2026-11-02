import "server-only";

import { RRuleTemporal } from "rrule-temporal";
import { Temporal } from "temporal-polyfill";

/** A local wall-clock time, "YYYY-MM-DDTHH:mm", as the schedule form sends it. */
export type LocalDateTime = string;

/**
 * The instant a local time happens in a time zone. In a daylight-saving gap or overlap
 * it takes the earlier sensible reading, as calendars do.
 */
export function zonedInstant(local: LocalDateTime, timeZone: string): Date {
  const zoned = Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone, {
    disambiguation: "compatible",
  });
  return new Date(zoned.epochMilliseconds);
}

/** A local time again, for editing: the instant as seen in the time zone. */
export function localDateTime(instant: Date, timeZone: string): LocalDateTime {
  return Temporal.Instant.fromEpochMilliseconds(instant.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}

/** The last moment of a local date in a time zone, as an RRULE UNTIL ("…T235959Z"). */
export function untilUtc(localDate: string, timeZone: string): string {
  const end = Temporal.PlainDate.from(localDate)
    .toZonedDateTime({ timeZone, plainTime: "23:59:59" })
    .toInstant();
  return end.toString().replace(/[-:]/g, "").replace(/\.\d+/, "");
}

export const isTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
};

export type RuleRow = {
  rrule: string;
  firstStart: Date;
  lastStart: Date | null;
  durationMin: number;
  timeZone: string;
};

export type ExceptionRow = {
  originalStart: Date;
  cancelled: boolean;
  startsAt: Date | null;
  durationMin: number | null;
  title: string | null;
};

export type Occurrence = {
  /** Identifies the occurrence, even after it moves. */
  originalStart: Date;
  start: Date;
  end: Date;
  /** A one-off title for this occurrence. */
  title: string | null;
  moved: boolean;
};

const zoned = (instant: Date, timeZone: string) =>
  Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(
    timeZone,
  );

function ruleOf(row: RuleRow) {
  return new RRuleTemporal({
    rruleString: row.rrule,
    dtstart: zoned(row.firstStart, row.timeZone),
    temporal: Temporal,
  });
}

/** Planned starts of a rule within [from, to), in its time zone (DST keeps local time). */
function startsBetween(row: RuleRow, from: Date, to: Date): Date[] {
  const until = row.lastStart && row.lastStart < to ? row.lastStart : to;
  if (until < from) return [];
  return ruleOf(row)
    .between(zoned(from, row.timeZone), zoned(until, row.timeZone), true)
    .map((start) => new Date(start.epochMilliseconds))
    .filter((start) => start >= from && start < to && start <= until);
}

/** Whether a rule produces an occurrence at exactly this planned start. */
function hasStart(row: RuleRow, start: Date): boolean {
  const near = new Date(start.getTime() + 1000);
  return startsBetween(row, start, near).some(
    (s) => s.getTime() === start.getTime(),
  );
}

/**
 * A series' occurrences that overlap [from, to): its rules expanded in the meeting's time
 * zone, with cancelled ones dropped and moved ones moved. Capped at `limit`.
 */
export function occurrencesBetween(input: {
  rules: RuleRow[];
  exceptions: ExceptionRow[];
  from: Date;
  to: Date;
  limit?: number;
}): Occurrence[] {
  const { rules, exceptions, from, to } = input;
  const limit = input.limit ?? 500;
  const byStart = new Map(
    exceptions.map((e) => [e.originalStart.getTime(), e] as const),
  );
  const found = new Map<number, Occurrence>();

  const add = (row: RuleRow, original: Date) => {
    const change = byStart.get(original.getTime());
    if (change?.cancelled) return;
    const start = change?.startsAt ?? original;
    const minutes = change?.durationMin ?? row.durationMin;
    const end = new Date(start.getTime() + minutes * 60_000);
    if (end <= from || start >= to) return;
    found.set(original.getTime(), {
      originalStart: original,
      start,
      end,
      title: change?.title ?? null,
      moved: change?.startsAt != null || change?.durationMin != null,
    });
  };

  for (const row of rules) {
    // Look back a duration, so a meeting already under way at `from` is included.
    const lookBack = new Date(from.getTime() - row.durationMin * 60_000);
    for (const start of startsBetween(row, lookBack, to)) add(row, start);
  }
  // Occurrences moved into the window from elsewhere.
  for (const change of exceptions) {
    if (change.cancelled || !change.startsAt) continue;
    if (found.has(change.originalStart.getTime())) continue;
    if (change.startsAt >= to) continue;
    const row = rules.find((r) => hasStart(r, change.originalStart));
    if (row) add(row, change.originalStart);
  }

  return [...found.values()]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit);
}

/** The planned start of a rule's last occurrence, or null when it repeats forever. */
export function lastStartOf(row: RuleRow): Date | null {
  if (row.lastStart) return row.lastStart;
  const rule = ruleOf(row);
  const options = rule.options();
  if (options.count === undefined && options.until === undefined) return null;
  const all = rule.all();
  const last = all.at(-1);
  return last ? new Date(last.epochMilliseconds) : null;
}
