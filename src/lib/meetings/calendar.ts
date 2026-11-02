/**
 * Adding a meeting to someone's calendar without any sign-in: Google and Outlook links,
 * and an iCalendar (.ics) file for Apple Calendar and everything else.
 */

export type CalendarEvent = {
  /** Stable across edits, so calendars update the event instead of adding another. */
  uid: string;
  title: string;
  /** The invitation text. */
  description: string;
  /** The join link. */
  location: string;
  start: Date;
  end: Date;
  timeZone: string;
  /** RRULE body ("FREQ=WEEKLY;BYDAY=TU") for a series, else null. */
  rrule: string | null;
  invitees: string[];
  /** A series: planned starts that were cancelled. */
  cancelled?: Date[];
  /** A series: occurrences moved or retitled. */
  moved?: Array<{ originalStart: Date; start: Date; end: Date; title: string }>;
};

/** "20261103T190000Z" */
const utcStamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

/** "20261103T140000" in a time zone. */
function localStamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Google Calendar's event template, prefilled: title, time, details, location and the
 * invitees (`add`), plus the repeat rule. The host saves it and Google invites people.
 */
export function googleCalendarLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.start)}/${utcStamp(event.end)}`,
    ctz: event.timeZone,
    details: event.description,
    location: event.location,
  });
  if (event.invitees.length > 0) params.set("add", event.invitees.join(","));
  if (event.rrule) params.set("recur", `RRULE:${event.rrule}`);
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Outlook on the web's compose form. It can't take a repeat rule or invitees. */
export function outlookLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    body: event.description,
    location: event.location,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/** Folds a content line at 75 octets, as RFC 5545 asks. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length;
    if (size + charSize > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  out.push(current);
  return out.join("\r\n ");
}

/**
 * An iCalendar file (METHOD:PUBLISH) for the meeting: the series with its RRULE, an
 * EXDATE for each cancelled meeting and a RECURRENCE-ID event for each moved one.
 */
export function icsFile(event: CalendarEvent, now = new Date()): string {
  const tz = event.timeZone;
  const at = (date: Date) => `;TZID=${tz}:${localStamp(date, tz)}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FaceOn//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const common = [
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${event.location}`,
  ];
  lines.push(
    "BEGIN:VEVENT",
    ...common,
    `DTSTART${at(event.start)}`,
    `DTEND${at(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  );
  if (event.rrule) lines.push(`RRULE:${event.rrule}`);
  for (const cancelled of event.cancelled ?? []) {
    lines.push(`EXDATE${at(cancelled)}`);
  }
  lines.push("END:VEVENT");
  for (const moved of event.moved ?? []) {
    lines.push(
      "BEGIN:VEVENT",
      ...common,
      `RECURRENCE-ID${at(moved.originalStart)}`,
      `DTSTART${at(moved.start)}`,
      `DTEND${at(moved.end)}`,
      `SUMMARY:${escapeText(moved.title)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
