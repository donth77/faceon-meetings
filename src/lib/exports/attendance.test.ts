import { describe, expect, it } from "vitest";

import { groupVisits } from "@/lib/meetings/attendees";

import {
  attendanceRows,
  shownEmail,
  type AttendanceLabels,
} from "./attendance";

const labels: AttendanceLabels = {
  name: "Name",
  email: "Email",
  joinedAs: "Joined as",
  host: "Host",
  account: "Account",
  guest: "Guest",
  firstJoined: "First joined (UTC)",
  lastLeft: "Last left (UTC)",
  minutes: "Minutes",
  timesJoined: "Times joined",
};

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 10, 2, 14, 0) + minutes * 60_000);

describe("whose email an attendance file shows", () => {
  const base = {
    invited: new Set(["maya@example.com"]),
    readerMediaId: "u_host",
    readerEmail: "host@example.com",
  };

  it("shows the host's own, and invitees' by their account's address", () => {
    expect(
      shownEmail({
        ...base,
        mediaUserId: "u_host",
        accountEmail: "host@example.com",
      }),
    ).toBe("host@example.com");
    expect(
      shownEmail({
        ...base,
        mediaUserId: "u_maya",
        accountEmail: "Maya@Example.com",
      }),
    ).toBe("Maya@Example.com");
  });

  it("never shows anyone else's account address, and guests have none", () => {
    expect(
      shownEmail({
        ...base,
        mediaUserId: "u_sam",
        accountEmail: "sam@example.com",
      }),
    ).toBeNull();
    expect(
      shownEmail({
        ...base,
        mediaUserId: "g_guest",
        accountEmail: "maya@example.com",
      }),
    ).toBeNull();
    expect(
      shownEmail({ ...base, mediaUserId: "u_maya", accountEmail: null }),
    ).toBeNull();
  });

  it("shows no invitee's address to someone who doesn't host the meeting", () => {
    expect(
      shownEmail({
        ...base,
        invited: new Set(),
        readerMediaId: "u_sam",
        readerEmail: "sam@example.com",
        mediaUserId: "u_maya",
        accountEmail: "maya@example.com",
      }),
    ).toBeNull();
  });
});

describe("attendance rows", () => {
  it("has one row per person, first to arrive first, visits added up", () => {
    const people = groupVisits([
      {
        mediaUserId: "g_1",
        name: "=Guest",
        image: null,
        joinedAt: at(5),
        leftAt: at(20),
      },
      {
        mediaUserId: "u_host",
        name: "Host",
        image: null,
        joinedAt: at(0),
        leftAt: at(60),
      },
      {
        mediaUserId: "g_1",
        name: "=Guest",
        image: null,
        joinedAt: at(30),
        leftAt: at(45),
      },
    ]);
    const rows = attendanceRows({
      people,
      hostMediaId: "u_host",
      emailOf: (id) => (id === "u_host" ? "host@example.com" : null),
      timeZone: "UTC",
      labels,
    });
    expect(rows[0]).toEqual([
      "Name",
      "Email",
      "Joined as",
      "First joined (UTC)",
      "Last left (UTC)",
      "Minutes",
      "Times joined",
    ]);
    expect(rows[1]).toEqual([
      "Host",
      "host@example.com",
      "Host",
      "2026-11-02 14:00",
      "2026-11-02 15:00",
      60,
      1,
    ]);
    expect(rows[2]).toEqual([
      "=Guest",
      "",
      "Guest",
      "2026-11-02 14:05",
      "2026-11-02 14:45",
      30,
      2,
    ]);
  });

  it("writes times in the reader's time zone", () => {
    const people = groupVisits([
      {
        mediaUserId: "u_a",
        name: "Ana",
        image: null,
        joinedAt: at(0),
        leftAt: at(10),
      },
    ]);
    const [, row] = attendanceRows({
      people,
      hostMediaId: "u_host",
      emailOf: () => null,
      timeZone: "America/New_York",
      labels,
    });
    expect(row?.[2]).toBe("Account");
    expect(row?.[3]).toBe("2026-11-02 09:00");
  });
});
