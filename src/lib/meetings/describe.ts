/**
 * Putting schedules into words, in the reader's language: the Repeat menu's choices,
 * repeat summaries ("Every week on Tue and Thu, until Mar 31, 2027"), short chips
 * ("Weekly") and the invitation text. Works on the server and in the browser; callers
 * pass a translator for the "Recurrence" messages.
 */
import type messages from "../../../messages/en.json";
import {
  startFacts,
  WEEKDAYS,
  type Recurrence,
  type RepeatPreset,
  type StartFacts,
  type Weekday,
} from "./recurrence";

type RecurrenceKey = keyof (typeof messages)["Recurrence"];

/** next-intl's translator for the "Recurrence" messages, on the server or in the browser. */
export type Translate = (
  key: RecurrenceKey,
  values?: Record<string, string | number>,
) => string;

/** A weekday code as a date in a known week (2026-11-02 was a Monday). */
const weekdayDate = (day: Weekday) =>
  new Date(Date.UTC(2026, 10, 2 + WEEKDAYS.indexOf(day), 12));

const weekdayName = (day: Weekday, locale: string, width: "long" | "short") =>
  new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
    weekdayDate(day),
  );

const monthDay = (facts: StartFacts, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, facts.month - 1, facts.day, 12)));

/** "Weekly on Tuesday", worked out from the start date. */
export function presetLabel(
  t: Translate,
  preset: RepeatPreset | "custom",
  facts: StartFacts,
  locale: string,
): string {
  const weekday = weekdayName(facts.weekday, locale, "long");
  switch (preset) {
    case "weekly":
      return t("weeklyOn", { weekday });
    case "monthly":
      return t("monthlyOn", { nth: facts.nth === 5 ? 0 : facts.nth, weekday });
    case "yearly":
      return t("yearlyOn", { date: monthDay(facts, locale) });
    default:
      return t(preset);
  }
}

const WORKWEEK = ["MO", "TU", "WE", "TH", "FR"];

/** "Every week on Tue and Thu, until Mar 31, 2027". */
export function describeRecurrence(
  t: Translate,
  recurrence: Recurrence,
  startDate: string,
  locale: string,
): string {
  const facts = startFacts(startDate);
  const interval = recurrence.interval;
  let rule: string;
  switch (recurrence.freq) {
    case "DAILY":
      rule = t("everyDays", { interval });
      break;
    case "WEEKLY": {
      const days = recurrence.byDay?.length
        ? recurrence.byDay
        : [facts.weekday];
      if (
        interval === 1 &&
        days.length === 5 &&
        WORKWEEK.every((d) => days.includes(d as Weekday))
      ) {
        rule = t("everyWeekday");
      } else {
        const names = WEEKDAYS.filter((d) => days.includes(d)).map((d) =>
          weekdayName(d, locale, "short"),
        );
        rule = t("everyWeeks", {
          interval,
          days: new Intl.ListFormat(locale, {
            style: "long",
            type: "conjunction",
          }).format(names),
        });
      }
      break;
    }
    case "MONTHLY":
      rule =
        (recurrence.monthly ?? "date") === "date"
          ? t("everyMonthsOnDay", { interval, day: facts.day })
          : t("everyMonthsOnWeekday", {
              interval,
              nth: recurrence.monthly === "lastWeekday" ? 0 : facts.nth,
              weekday: weekdayName(facts.weekday, locale, "long"),
            });
      break;
    case "YEARLY":
      rule = t("everyYears", { interval, date: monthDay(facts, locale) });
      break;
  }
  if (recurrence.end.kind === "on") {
    const [y = 1970, m = 1, d = 1] = recurrence.end.date.split("-").map(Number);
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
    return t("until", { rule, date });
  }
  if (recurrence.end.kind === "after") {
    return t("times", { rule, count: recurrence.end.count });
  }
  return rule;
}

/** The short chip for a series: "Weekly", "Every weekday"… */
export function recurrenceChip(t: Translate, recurrence: Recurrence): string {
  if (
    recurrence.freq === "WEEKLY" &&
    recurrence.interval === 1 &&
    recurrence.byDay?.length === 5 &&
    WORKWEEK.every((d) => recurrence.byDay?.includes(d as Weekday))
  ) {
    return t("chipWeekdays");
  }
  return t(`chip${recurrence.freq}`);
}

/**
 * A stored RRULE back as a recurrence, for words and for editing. UNTIL becomes the local
 * date in the meeting's time zone.
 */
export function fromRRule(rrule: string, timeZone: string): Recurrence {
  const parts = Object.fromEntries(
    rrule.split(";").map((part) => part.split("=") as [string, string]),
  );
  const freq = (parts.FREQ ?? "WEEKLY") as Recurrence["freq"];
  const interval = Number(parts.INTERVAL ?? 1);
  let end: Recurrence["end"] = { kind: "never" };
  if (parts.COUNT) end = { kind: "after", count: Number(parts.COUNT) };
  else if (parts.UNTIL) {
    const u = parts.UNTIL;
    const instant = new Date(
      `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}T${u.slice(9, 11)}:${u.slice(11, 13)}:${u.slice(13, 15)}Z`,
    );
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
    end = { kind: "on", date: local };
  }
  const recurrence: Recurrence = { freq, interval, end };
  if (freq === "WEEKLY" && parts.BYDAY) {
    recurrence.byDay = parts.BYDAY.split(",").filter((d): d is Weekday =>
      (WEEKDAYS as readonly string[]).includes(d),
    );
  }
  if (freq === "MONTHLY") {
    recurrence.monthly = parts.BYMONTHDAY
      ? "date"
      : parts.BYDAY?.startsWith("-1")
        ? "lastWeekday"
        : "weekday";
  }
  return recurrence;
}
