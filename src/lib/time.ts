/**
 * Time-zone helpers that work in any browser (no Temporal): offsets, local times in a
 * zone, and labels like "New York (GMT−05:00)". The server uses Temporal for repeating
 * meetings; these cover forms and lists.
 */

const partsFormat = new Map<string, Intl.DateTimeFormat>();

function partsIn(timeZone: string): Intl.DateTimeFormat {
  let format = partsFormat.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    partsFormat.set(timeZone, format);
  }
  return format;
}

function wallClock(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    partsIn(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** How far a zone's local time is ahead of UTC at an instant, in ms. */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant of a local time ("YYYY-MM-DDTHH:mm[:ss]") in a zone. */
export function zonedToUtc(local: string, timeZone: string): Date {
  const [date = "1970-01-01", time = "00:00"] = local.split("T");
  const [y = 1970, mo = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, mi = 0, s = 0] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Near a daylight-saving change the offset can differ at the result; check once more.
  const second = guess - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** An instant's local date and time in a zone: "YYYY-MM-DD" and "HH:mm". */
export function localParts(
  instant: Date,
  timeZone: string,
): { date: string; time: string } {
  const w = wallClock(instant, timeZone);
  return {
    date: `${w.year}-${pad(w.month)}-${pad(w.day)}`,
    time: `${pad(w.hour)}:${pad(w.minute)}`,
  };
}

/** The last moment of a local date in a zone, as an RRULE UNTIL ("…T235959Z"). */
export function untilStamp(localDate: string, timeZone: string): string {
  return zonedToUtc(`${localDate}T23:59:59`, timeZone)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "");
}

/** "New York" for "America/New_York". */
export function zoneCity(timeZone: string): string {
  return (timeZone.split("/").at(-1) ?? timeZone).replace(/_/g, " ");
}

/** "GMT−05:00" (with a real minus sign). */
export function zoneOffsetLabel(
  timeZone: string,
  locale: string,
  at: Date = new Date(),
): string {
  const name =
    new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return name.replace("-", "−");
}

/** "New York (GMT−05:00)". */
export const zoneLabel = (timeZone: string, locale: string, at?: Date) =>
  `${zoneCity(timeZone)} (${zoneOffsetLabel(timeZone, locale, at)})`;

/**
 * The locale for dates and times: FaceOn's language with the browser's region, so a UK
 * browser reads "Sunday 1 November" and an American one "Sunday, November 1". A browser
 * in another language lends just its region ("en-DE").
 */
export function formattingLocale(language: string, browser: string): string {
  if (!browser) return language;
  try {
    const tag = new Intl.Locale(browser);
    if (tag.language === new Intl.Locale(language).language)
      return tag.baseName;
    const region = tag.maximize().region;
    return region ? new Intl.Locale(language, { region }).baseName : language;
  } catch {
    return language; // a tag Intl doesn't understand
  }
}

/**
 * A day such as "Sunday, November 1", with the year only when it isn't this year
 * ("Friday, January 8, 2027"). `options` names the parts, and the zone when it matters.
 */
export function formatDay(
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const yearIn = (instant: Date) =>
    new Intl.DateTimeFormat("en", {
      timeZone: options.timeZone,
      year: "numeric",
    }).format(instant);
  const otherYear = yearIn(date) !== yearIn(new Date());
  return new Intl.DateTimeFormat(
    locale,
    otherYear ? { ...options, year: "numeric" } : options,
  ).format(date);
}

/** "2:00 – 3:00 PM" in a zone. */
export function formatTimeRange(
  start: Date,
  end: Date,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(start, end);
}

/** Whether two instants fall on the same day in a zone. */
export function isSameDay(a: Date, b: Date, timeZone: string): boolean {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return day.format(a) === day.format(b);
}

/**
 * Two times joined the way the locale joins a range ("10:32 PM – 10:49 AM", "22:32–10:49
 * Uhr"), for times on different days, which Intl's own ranges would spell out in full.
 * The pattern comes from a range on one day whose ends share nothing (1 AM, 1 PM).
 */
function joinTimes(from: string, to: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).formatRangeToParts(
    new Date(Date.UTC(2026, 0, 1, 1)),
    new Date(Date.UTC(2026, 0, 1, 13)),
  );
  let joined = "";
  let placed = 0;
  let previous: string | undefined;
  for (const part of parts) {
    if (part.source === "shared") joined += part.value;
    else if (part.source !== previous) {
      joined += part.source === "startRange" ? from : to;
      placed++;
    }
    previous = part.source;
  }
  return placed === 2 ? joined : `${from} – ${to}`;
}

/**
 * A meeting's times in a zone, for a list grouped by the day it started: "2:00 – 3:00
 * PM", or, when it ends on a later day, "10:32 PM – 10:49 AM" and that day ("Mon, Nov 2")
 * to show with it.
 */
export function timeRangeParts(
  start: Date,
  end: Date,
  timeZone: string,
  locale: string,
): { times: string; endDay: string | null } {
  if (isSameDay(start, end, timeZone)) {
    return {
      times: formatTimeRange(start, end, timeZone, locale),
      endDay: null,
    };
  }
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    times: joinTimes(time.format(start), time.format(end), locale),
    endDay: new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(end),
  };
}

/**
 * A range on its own, with its days: "Sun, Nov 1 · 2:00 – 3:00 PM", or across days
 * "Sun, Nov 1, 10:32 PM – Mon, Nov 2, 10:49 AM". The year shows only when it isn't
 * this year's.
 */
export function formatSpan(
  start: Date,
  end: Date,
  timeZone: string,
  locale: string,
): string {
  const days: Intl.DateTimeFormatOptions = {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  if (isSameDay(start, end, timeZone)) {
    return `${formatDay(start, locale, days)} · ${formatTimeRange(start, end, timeZone, locale)}`;
  }
  const thisYear = (at: Date) =>
    new Intl.DateTimeFormat("en", { timeZone, year: "numeric" }).format(at) ===
    new Intl.DateTimeFormat("en", { timeZone, year: "numeric" }).format(
      new Date(),
    );
  return new Intl.DateTimeFormat(locale, {
    ...days,
    ...(thisYear(start) && thisYear(end) ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(start, end);
}

/** Intl.DurationFormat, which TypeScript's libraries don't describe yet. */
type DurationFormatConstructor = new (
  locale: string,
  options: { style: "short" | "long"; minutesDisplay?: "always" | "auto" },
) => { format(duration: { hours?: number; minutes?: number }): string };

/**
 * A length of time in whole minutes, as the locale says it: "31 min", "1 hr, 15 min"
 * ("1 hour, 15 minutes" in the long style). Intl.DurationFormat where the browser has
 * it, otherwise the same from unit numbers and a list.
 */
export function formatDuration(
  minutes: number,
  locale: string,
  style: "short" | "long" = "short",
): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const DurationFormat = (
    Intl as unknown as { DurationFormat?: DurationFormatConstructor }
  ).DurationFormat;
  if (DurationFormat) {
    return new DurationFormat(locale, {
      style,
      minutesDisplay: hours === 0 ? "always" : "auto",
    }).format(hours === 0 ? { minutes: rest } : { hours, minutes: rest });
  }
  const unit = (value: number, kind: "hour" | "minute") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit: kind,
      unitDisplay: style,
    }).format(value);
  const units = [
    ...(hours > 0 ? [unit(hours, "hour")] : []),
    ...(rest > 0 || hours === 0 ? [unit(rest, "minute")] : []),
  ];
  return new Intl.ListFormat(locale, { style, type: "unit" }).format(units);
}

/** "Tue, Nov 3, 2026 · 2:00 – 3:00 PM". */
export function formatWhen(
  start: Date,
  end: Date,
  timeZone: string,
  locale: string,
): string {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(start);
  return `${day} · ${formatTimeRange(start, end, timeZone, locale)}`;
}

/** Every time zone this browser knows, for pickers. */
export function timeZones(): string[] {
  const supported = (
    Intl as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.("timeZone");
  return supported?.length ? supported : ["UTC"];
}

/** The device's own time zone, whatever Settings says. Browser only. */
export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Whether this browser knows a time zone by that name. */
export function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The viewer's time zone: the one chosen in Settings → General on this device, or else
 * the device's own. Browser only; components use useViewerTimeZone().
 */
export function viewerTimeZone(): string {
  try {
    const raw = localStorage.getItem("faceon.prefs");
    const zone = raw
      ? (JSON.parse(raw) as { timeZone?: unknown }).timeZone
      : null;
    if (isTimeZone(zone)) return zone;
  } catch {
    // No storage: use the device's.
  }
  return systemTimeZone();
}

/** The first day of the week where the reader lives: 0 for Sunday, 1 for Monday… */
export function weekStartsOn(locale: string): number {
  const info = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const firstDay =
    info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay ?? 7;
  return firstDay % 7;
}
