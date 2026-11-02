import { describe, expect, it } from "vitest";

import { attendeesOf, minutesBetween, type Visit } from "./attendees";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 2, 10, minute));
const visit = (
  mediaUserId: string,
  from: number,
  to: number,
  name = mediaUserId,
): Visit => ({
  mediaUserId,
  name,
  image: null,
  joinedAt: at(from),
  leftAt: at(to),
});
const who = { viewerMediaId: "u_me", hostMediaId: "u_host" };

describe("attendeesOf", () => {
  it("adds up someone's visits and lists each one", () => {
    const { attendees } = attendeesOf(
      [visit("u_me", 0, 10), visit("u_me", 20, 25)],
      who,
    );
    expect(attendees).toHaveLength(1);
    expect(attendees[0]).toMatchObject({
      minutes: 15,
      joinedAt: at(0).toISOString(),
      leftAt: at(25).toISOString(),
    });
    expect(attendees[0]?.visits).toHaveLength(2);
  });

  it("lists no visits for someone who came once", () => {
    const { attendees } = attendeesOf([visit("u_host", 0, 30)], who);
    expect(attendees[0]?.visits).toEqual([]);
  });

  it("marks you, the host and guests from media IDs", () => {
    const { attendees } = attendeesOf(
      [visit("u_host", 0, 30), visit("u_me", 1, 30), visit("g_abc", 2, 30)],
      who,
    );
    expect(
      attendees.map(({ isHost, isYou, isGuest }) => ({
        isHost,
        isYou,
        isGuest,
      })),
    ).toEqual([
      { isHost: true, isYou: false, isGuest: false },
      { isHost: false, isYou: true, isGuest: false },
      { isHost: false, isYou: false, isGuest: true },
    ]);
  });

  it("puts the first to arrive first, and spans the session", () => {
    const { attendees, start, end } = attendeesOf(
      [visit("u_late", 5, 40, "Late"), visit("u_early", 0, 20, "Early")],
      who,
    );
    expect(attendees.map((a) => a.name)).toEqual(["Early", "Late"]);
    expect(start).toEqual(at(0));
    expect(end).toEqual(at(40));
  });

  it("never puts a leave before its join", () => {
    const { attendees } = attendeesOf([visit("u_me", 10, 9)], who);
    expect(attendees[0]).toMatchObject({
      joinedAt: at(10).toISOString(),
      leftAt: at(10).toISOString(),
      minutes: 1,
    });
  });

  it("has no span without anybody", () => {
    expect(attendeesOf([], who)).toEqual({
      attendees: [],
      start: null,
      end: null,
    });
  });
});

describe("minutesBetween", () => {
  it("rounds, and counts at least a minute", () => {
    expect(minutesBetween(at(0), at(0))).toBe(1);
    expect(minutesBetween(at(0), new Date(at(0).getTime() + 89_000))).toBe(1);
    expect(minutesBetween(at(0), new Date(at(0).getTime() + 91_000))).toBe(2);
  });
});
