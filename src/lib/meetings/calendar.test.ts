import { describe, expect, it } from "vitest";

import {
  googleCalendarLink,
  icsFile,
  outlookLink,
  type CalendarEvent,
} from "./calendar";

const event: CalendarEvent = {
  uid: "6f1c@faceon",
  title: "Product sync",
  description: "Maya is inviting you.\nJoin: https://faceon.test/j/5843016279",
  location: "https://faceon.test/j/5843016279",
  start: new Date("2026-11-03T19:00:00Z"),
  end: new Date("2026-11-03T20:00:00Z"),
  timeZone: "America/New_York",
  rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
  invitees: ["ben@example.com", "priya@example.com"],
};

describe("googleCalendarLink", () => {
  it("prefills the event, invitees and repeat rule", () => {
    const url = new URL(googleCalendarLink(event));
    expect(url.searchParams.get("dates")).toBe(
      "20261103T190000Z/20261103T200000Z",
    );
    expect(url.searchParams.get("ctz")).toBe("America/New_York");
    expect(url.searchParams.get("add")).toBe(
      "ben@example.com,priya@example.com",
    );
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;BYDAY=TU,TH");
  });
});

describe("outlookLink", () => {
  it("uses ISO times", () => {
    const url = new URL(outlookLink(event));
    expect(url.searchParams.get("startdt")).toBe("2026-11-03T19:00:00.000Z");
  });
});

describe("icsFile", () => {
  const ics = icsFile(
    {
      ...event,
      cancelled: [new Date("2026-11-10T19:00:00Z")],
      moved: [
        {
          originalStart: new Date("2026-11-12T19:00:00Z"),
          start: new Date("2026-11-12T20:00:00Z"),
          end: new Date("2026-11-12T21:00:00Z"),
          title: "Product sync (moved)",
        },
      ],
    },
    new Date("2026-11-01T12:00:00Z"),
  );

  it("keeps local times in the meeting's time zone", () => {
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261103T140000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU,TH");
    expect(ics).toContain("EXDATE;TZID=America/New_York:20261110T140000");
    expect(ics).toContain(
      "RECURRENCE-ID;TZID=America/New_York:20261112T140000",
    );
  });

  it("adds a reminder only when asked", () => {
    expect(ics).not.toContain("BEGIN:VALARM");
    const reminded = icsFile({ ...event, reminderMinutes: 10 });
    expect(reminded).toContain("BEGIN:VALARM\r\nACTION:DISPLAY");
    expect(reminded).toContain("TRIGGER:-PT10M");
  });

  it("escapes text and uses CRLF line endings", () => {
    expect(ics).toContain(
      String.raw`DESCRIPTION:Maya is inviting you.\nJoin: https`,
    );
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
