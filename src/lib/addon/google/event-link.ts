import type { GoogleAddonEvent } from "./types";

/** The event's page in Google Calendar, for its host (the meeting page links to it). */
export function googleEventUrl({
  eventId,
  calendarId,
}: GoogleAddonEvent): string {
  const eid = Buffer.from(`${eventId} ${calendarId}`)
    .toString("base64")
    .replace(/=+$/, "");
  return `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eid)}`;
}
