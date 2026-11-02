import { describe, expect, it } from "vitest";

import {
  changesFrom,
  codeOf,
  timingOf,
  type CalendarEvent,
} from "./calendar-events";

const ours = (code: string) => ({
  conferenceSolution: { key: { type: "addOn" } },
  conferenceId: code,
  parameters: { addOnParameters: { parameters: { faceonCode: code } } },
});
const nobody = () => null;

describe("codeOf and timingOf", () => {
  it("finds FaceOn's meeting on an event, and not Meet's", () => {
    expect(codeOf({ conferenceData: ours("1234567890") })).toBe("1234567890");
    expect(
      codeOf({
        conferenceData: {
          conferenceSolution: { key: { type: "hangoutsMeet" } },
        },
      }),
    ).toBeNull();
    expect(codeOf({})).toBeNull();
  });

  it("reads a timed event, an all-day one, and one still without a time", () => {
    expect(
      timingOf({
        summary: "Standup",
        start: {
          dateTime: "2026-11-10T09:00:00-05:00",
          timeZone: "America/New_York",
        },
        end: { dateTime: "2026-11-10T09:15:00-05:00" },
        recurrence: ["RRULE:FREQ=DAILY"],
      }),
    ).toEqual({
      title: "Standup",
      start: "2026-11-10T09:00:00-05:00",
      end: "2026-11-10T09:15:00-05:00",
      timeZone: "America/New_York",
      recurrence: ["RRULE:FREQ=DAILY"],
    });
    expect(
      timingOf(
        { start: { date: "2026-11-12" }, end: { date: "2026-11-13" } },
        "Europe/Paris",
      ),
    ).toEqual({
      start: "2026-11-12T00:00:00Z",
      end: "2026-11-13T00:00:00Z",
      timeZone: "Europe/Paris",
      allDay: true,
    });
    expect(timingOf({})).toBeUndefined();
  });
});

describe("changesFrom", () => {
  const time = {
    start: { dateTime: "2026-11-10T15:00:00Z" },
    end: { dateTime: "2026-11-10T15:30:00Z" },
  };

  it("sends a changed event that this calendar organizes", () => {
    const events: CalendarEvent[] = [
      {
        id: "e1",
        summary: "Moved",
        organizer: { self: true },
        conferenceData: ours("111"),
        ...time,
      },
      // An invitee's copy: the organizer's add-on keeps that meeting.
      {
        id: "e2",
        summary: "Theirs",
        organizer: {},
        conferenceData: ours("222"),
        ...time,
      },
      // Not FaceOn's.
      { id: "e3", summary: "Meet", organizer: { self: true }, ...time },
    ];
    expect(changesFrom(events, nobody, "UTC")).toEqual([
      {
        kind: "update",
        code: "111",
        update: {
          event: {
            title: "Moved",
            start: "2026-11-10T15:00:00Z",
            end: "2026-11-10T15:30:00Z",
            timeZone: "UTC",
          },
        },
      },
    ]);
  });

  it("sends one meeting of a series moved or removed", () => {
    const moved: CalendarEvent = {
      id: "e1_20261117T150000Z",
      recurringEventId: "e1",
      originalStartTime: { dateTime: "2026-11-17T15:00:00Z" },
      organizer: { self: true },
      conferenceData: ours("111"),
      start: { dateTime: "2026-11-18T16:00:00Z" },
      end: { dateTime: "2026-11-18T16:30:00Z" },
    };
    const removed: CalendarEvent = {
      id: "e1_20261124T150000Z",
      recurringEventId: "e1",
      originalStartTime: { dateTime: "2026-11-24T15:00:00Z" },
      status: "cancelled",
    };
    expect(
      changesFrom([moved, removed], (id) => (id === "e1" ? "111" : null)),
    ).toEqual([
      {
        kind: "update",
        code: "111",
        update: {
          occurrence: {
            originalStart: "2026-11-17T15:00:00Z",
            start: "2026-11-18T16:00:00Z",
            end: "2026-11-18T16:30:00Z",
          },
        },
      },
      {
        kind: "update",
        code: "111",
        update: {
          occurrence: {
            originalStart: "2026-11-24T15:00:00Z",
            cancelled: true,
          },
        },
      },
    ]);
  });

  it("cancels the meeting when its event is deleted, or loses FaceOn's conference", () => {
    const known = (id: string) => ({ e1: "111", e2: "222" })[id] ?? null;
    expect(
      changesFrom(
        [
          { id: "e1", status: "cancelled" },
          { id: "e2", organizer: { self: true }, ...time },
          { id: "e3", status: "cancelled" },
        ],
        known,
      ),
    ).toEqual([
      { kind: "deleted", code: "111", eventId: "e1" },
      { kind: "deleted", code: "222", eventId: "e2" },
    ]);
  });
});
