/**
 * A Calendar event's time and repeat, as FaceOn's schedule takes them: a local start in
 * the event's zone, a length, and a repeat FaceOn follows exactly, or none. A repeat
 * FaceOn can't express exactly isn't approximated: the meeting has no fixed time instead
 * (one meeting ID that works whenever the event happens). Pure, so it's tested alone.
 */
import { fromRRule } from "@/lib/meetings/describe";
import {
  Recurrence,
  startFacts,
  toRRule,
  type StartFacts,
} from "@/lib/meetings/recurrence";
import { MAX_TITLE } from "@/lib/meetings/schedule";
import { isTimeZone, localParts, untilStamp } from "@/lib/time";

import type { EventTiming } from "./types";

const SHORTEST = 5;
const LONGEST = 24 * 60;

export type EventSchedule = {
  title: string | null;
  /** Null when FaceOn can't follow the event's repeat. */
  timed: {
    /** "YYYY-MM-DDTHH:mm", in `timeZone`. */
    start: string;
    timeZone: string;
    durationMin: number;
    recurrence: Recurrence | null;
  } | null;
};

export function scheduleOfEvent(
  event: EventTiming,
  fallbackZone = "UTC",
): EventSchedule {
  const title = event.title?.trim().slice(0, MAX_TITLE) || null;
  const timeZone =
    event.timeZone && isTimeZone(event.timeZone)
      ? event.timeZone
      : fallbackZone;
  const startAt = new Date(event.start);
  const local = event.allDay
    ? { date: event.start.slice(0, 10), time: "00:00" }
    : localParts(startAt, timeZone);
  const minutes = Math.round(
    (new Date(event.end).getTime() - startAt.getTime()) / 60_000,
  );
  const durationMin = Math.min(
    LONGEST,
    Math.max(SHORTEST, Number.isFinite(minutes) ? minutes : 60),
  );
  // Removed meetings arrive as their own cancelled events, so EXDATE lines don't matter.
  const rules = (event.recurrence ?? []).filter((line) =>
    /^(RRULE|EXRULE|RDATE)[:;]/i.test(line),
  );
  let recurrence: Recurrence | null = null;
  if (rules.length > 0) {
    const [only] = rules;
    recurrence =
      rules.length === 1 && only && /^RRULE:/i.test(only)
        ? followable(only.slice("RRULE:".length), local.date, timeZone)
        : null;
    if (!recurrence) return { title, timed: null };
  }
  return {
    title,
    timed: {
      start: `${local.date}T${local.time}`,
      timeZone,
      durationMin,
      recurrence,
    },
  };
}

/**
 * The repeat, when FaceOn's own rule for it says exactly the same thing: written back
 * out from FaceOn's form, it must match Google's rule part for part. Anything FaceOn's
 * repeats can't say (every other Tuesday and Thursday is fine; the second-to-last day of
 * the month isn't) comes back null.
 */
export function followable(
  rrule: string,
  localDate: string,
  timeZone: string,
): Recurrence | null {
  const parsed = Recurrence.safeParse(fromRRule(rrule, timeZone));
  if (!parsed.success) return null;
  const facts = startFacts(localDate);
  const again = toRRule(
    parsed.data,
    facts,
    parsed.data.end.kind === "on"
      ? untilStamp(parsed.data.end.date, timeZone)
      : null,
  );
  return sameRule(rrule, again, facts) ? parsed.data : null;
}

function partsOf(rrule: string): Map<string, string> {
  const parts = new Map<string, string>();
  for (const part of rrule.split(";")) {
    const [key = "", value = ""] = part.split("=");
    if (key) parts.set(key.trim().toUpperCase(), value.trim().toUpperCase());
  }
  parts.delete("WKST");
  if (parts.get("INTERVAL") === "1") parts.delete("INTERVAL");
  const days = parts.get("BYDAY");
  if (days) parts.set("BYDAY", days.split(",").sort().join(","));
  return parts;
}

function sameRule(original: string, again: string, facts: StartFacts): boolean {
  const a = partsOf(original);
  const b = partsOf(again);
  // A weekly rule without days repeats on the start's own day, as FaceOn writes it.
  if (a.get("FREQ") === "WEEKLY" && !a.has("BYDAY"))
    a.set("BYDAY", facts.weekday);
  // UNTIL may be a date or a moment; FaceOn ends on a local date, so both just need one.
  if (a.has("UNTIL") !== b.has("UNTIL")) return false;
  a.delete("UNTIL");
  b.delete("UNTIL");
  return (
    a.size === b.size && [...a].every(([key, value]) => b.get(key) === value)
  );
}
