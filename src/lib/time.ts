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

/** This device's time zone. */
export const deviceTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
