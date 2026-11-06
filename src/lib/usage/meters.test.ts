import { describe, expect, it } from "vitest";

import {
  alertKey,
  alertsDue,
  allowanceSpent,
  attendanceMissing,
  dayBefore,
  emailsByDay,
  emailsUsed,
  inUsageOrder,
  meterStatus,
  participantMinutes,
  quotaHeader,
  resendInstant,
  usedShare,
  utcDay,
  utcMonth,
  type Reading,
} from "./meters";

const at = (iso: string) => new Date(iso);

describe("meter status", () => {
  it("is fine below 80%, near from 80% and reached at 100%", () => {
    expect(meterStatus(79, 100)).toBe("ok");
    expect(meterStatus(80, 100)).toBe("near");
    expect(meterStatus(99.9, 100)).toBe("near");
    expect(meterStatus(100, 100)).toBe("over");
    expect(meterStatus(140, 100)).toBe("over");
  });

  it("counts exactly 80% of an allowance that doesn't divide evenly", () => {
    // 80% of Stream's 333,000 minutes is 266,400.
    expect(meterStatus(266_399, 333_000)).toBe("ok");
    expect(meterStatus(266_400, 333_000)).toBe("near");
  });

  it("has no share or warning without a limit", () => {
    expect(usedShare(500, 0)).toBeNull();
    expect(meterStatus(500, 0)).toBe("ok");
    expect(usedShare(25, 100)).toBe(0.25);
  });
});

describe("the order of the meters", () => {
  it("puts calls first, then the database and hosting, then emails", () => {
    const reading = (meter: Reading["meter"]): Reading => ({
      meter,
      period: "2026-11",
      used: 1,
      limit: 10,
    });
    const shuffled = [
      reading("mailtrapMonth"),
      reading("emailsDay"),
      reading("neon"),
      reading("mailtrapDay"),
      reading("stream"),
      reading("emailsMonth"),
    ];
    expect(inUsageOrder(shuffled).map((r) => r.meter)).toEqual([
      "stream",
      "neon",
      "emailsDay",
      "emailsMonth",
      "mailtrapDay",
      "mailtrapMonth",
    ]);
  });
});

describe("periods", () => {
  it("takes the UTC month, whatever the server's time zone", () => {
    const month = utcMonth(at("2026-11-04T09:30:00Z"));
    expect(month.key).toBe("2026-11");
    expect(month.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(month.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(utcMonth(at("2026-12-31T23:59:59Z")).end.toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("names UTC days, and the day before one", () => {
    expect(utcDay(at("2026-11-04T23:30:00-05:00"))).toBe("2026-11-05");
    expect(dayBefore("2026-11-01")).toBe("2026-10-31");
    expect(dayBefore("2027-01-01")).toBe("2026-12-31");
    expect(dayBefore("2028-03-01")).toBe("2028-02-29");
  });
});

describe("participant-minutes", () => {
  const month = utcMonth(at("2026-11-15T00:00:00Z"));
  const now = at("2026-11-15T12:00:00Z");

  it("adds each person's time connected", () => {
    const minutes = participantMinutes(
      [
        {
          joinedAt: at("2026-11-02T10:00:00Z"),
          leftAt: at("2026-11-02T10:30:00Z"),
          endedAt: at("2026-11-02T10:31:00Z"),
        },
        {
          joinedAt: at("2026-11-02T10:05:00Z"),
          leftAt: at("2026-11-02T10:20:00Z"),
          endedAt: at("2026-11-02T10:31:00Z"),
        },
      ],
      month,
      now,
    );
    expect(minutes).toBe(45);
  });

  it("counts only the part of a call inside the month", () => {
    expect(
      participantMinutes(
        [
          {
            joinedAt: at("2026-10-31T23:50:00Z"),
            leftAt: at("2026-11-01T00:10:00Z"),
            endedAt: null,
          },
          {
            joinedAt: at("2026-10-20T10:00:00Z"),
            leftAt: at("2026-10-20T11:00:00Z"),
            endedAt: null,
          },
        ],
        month,
        now,
      ),
    ).toBe(10);
  });

  it("counts a connection still open until now", () => {
    expect(
      participantMinutes(
        [
          {
            joinedAt: at("2026-11-15T11:00:00Z"),
            leftAt: null,
            endedAt: null,
          },
        ],
        month,
        now,
      ),
    ).toBe(60);
  });

  it("ends a connection whose leaving was missed with its session", () => {
    expect(
      participantMinutes(
        [
          {
            joinedAt: at("2026-11-03T09:00:00Z"),
            leftAt: null,
            endedAt: at("2026-11-03T09:40:00Z"),
          },
        ],
        month,
        now,
      ),
    ).toBe(40);
  });
});

describe("missing attendance", () => {
  const call = (minutes: number, connections: number, endedAt: string) => {
    const end = at(endedAt);
    return {
      startedAt: new Date(end.getTime() - minutes * 60_000),
      endedAt: end,
      connections,
    };
  };

  it("is missing when the latest call that ran a minute or more has nobody in it", () => {
    expect(attendanceMissing([call(3, 0, "2026-11-04T18:20:00Z")])).toBe(true);
    expect(
      attendanceMissing([
        call(1, 0, "2026-11-04T18:20:00Z"),
        call(12, 2, "2026-11-04T17:00:00Z"),
      ]),
    ).toBe(true);
  });

  it("isn't, once a later call has attendance again", () => {
    expect(
      attendanceMissing([
        call(2, 1, "2026-11-05T09:00:00Z"),
        call(3, 0, "2026-11-04T18:20:00Z"),
      ]),
    ).toBe(false);
  });

  it("skips calls shorter than a minute: someone let in who never connected", () => {
    expect(
      attendanceMissing([
        call(0.5, 0, "2026-11-05T09:00:00Z"),
        call(0, 0, "2026-11-05T08:00:00Z"),
        call(20, 3, "2026-11-04T18:20:00Z"),
      ]),
    ).toBe(false);
  });

  it("says nothing without a call long enough to tell", () => {
    expect(attendanceMissing([])).toBe(false);
    expect(attendanceMissing([call(0.9, 0, "2026-11-05T09:00:00Z")])).toBe(
      false,
    );
  });
});

describe("warnings", () => {
  const stream = (used: number): Reading => ({
    meter: "stream",
    period: "2026-11",
    used,
    limit: 333_000,
  });

  it("warns once at 80%", () => {
    expect(alertsDue([stream(200_000)], new Set())).toEqual([]);
    const [due] = alertsDue([stream(270_000)], new Set());
    expect(due).toMatchObject({ threshold: 80, covers: [] });
    expect(
      alertsDue(
        [stream(300_000)],
        new Set([alertKey("stream", "2026-11", 80)]),
      ),
    ).toEqual([]);
  });

  it("warns again at 100%", () => {
    const [due] = alertsDue(
      [stream(333_000)],
      new Set([alertKey("stream", "2026-11", 80)]),
    );
    expect(due).toMatchObject({ threshold: 100, covers: [] });
    expect(
      alertsDue(
        [stream(400_000)],
        new Set([
          alertKey("stream", "2026-11", 80),
          alertKey("stream", "2026-11", 100),
        ]),
      ),
    ).toEqual([]);
  });

  it("sends one warning for a jump straight past 100%, standing for the 80% one", () => {
    const due = alertsDue([stream(350_000)], new Set());
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ threshold: 100, covers: [80] });
  });

  it("starts over each period, and keeps meters apart", () => {
    const sent = new Set([alertKey("stream", "2026-10", 80)]);
    expect(alertsDue([stream(270_000)], sent)).toHaveLength(1);
    const emails: Reading = {
      meter: "emailsMonth",
      period: "2026-11",
      used: 2500,
      limit: 3000,
    };
    expect(
      alertsDue([emails], new Set([alertKey("stream", "2026-11", 80)])),
    ).toMatchObject([{ meter: "emailsMonth", threshold: 80 }]);
  });

  it("never warns about a meter without a limit", () => {
    expect(alertsDue([{ ...stream(9_999_999), limit: 0 }], new Set())).toEqual(
      [],
    );
  });
});

describe("email allowances", () => {
  it("counts the larger of FaceOn's and Resend's email counts", () => {
    expect(emailsUsed({ sent: 4, resend: null })).toBe(4);
    expect(emailsUsed({ sent: 4, resend: 9 })).toBe(9);
    expect(emailsUsed({ sent: 12, resend: 9 })).toBe(12);
  });

  it("is used up once a day's or the month's emails reach their limit", () => {
    const limits = { perDay: 100, perMonth: 3000 };
    const counts = (today: number, month: number) => ({
      today: { sent: today, resend: null },
      month: { sent: 0, resend: month },
    });
    expect(allowanceSpent(counts(99, 2999), limits)).toBe(false);
    expect(allowanceSpent(counts(100, 2999), limits)).toBe(true);
    expect(allowanceSpent(counts(12, 3000), limits)).toBe(true);
    expect(
      allowanceSpent(counts(5000, 90_000), { perDay: 0, perMonth: 0 }),
    ).toBe(false);
  });
});

describe("Resend's quota headers", () => {
  it("reads a count, and nothing else", () => {
    expect(quotaHeader("42")).toBe(42);
    expect(quotaHeader(" 7 ")).toBe(7);
    expect(quotaHeader("0")).toBe(0);
    expect(quotaHeader(null)).toBeNull();
    expect(quotaHeader("")).toBeNull();
    expect(quotaHeader("lots")).toBeNull();
    expect(quotaHeader("-1")).toBeNull();
    expect(quotaHeader("4.5")).toBeNull();
  });
});

describe("Resend's list of emails", () => {
  it("reads Resend's timestamps", () => {
    expect(resendInstant("2026-11-04 13:27:37.470000+00")?.toISOString()).toBe(
      "2026-11-04T13:27:37.470Z",
    );
    expect(resendInstant("2026-11-04 08:00:00+05")?.toISOString()).toBe(
      "2026-11-04T03:00:00.000Z",
    );
    expect(resendInstant("2026-11-04T13:27:37.47Z")?.toISOString()).toBe(
      "2026-11-04T13:27:37.470Z",
    );
    expect(resendInstant(null)).toBeNull();
    expect(resendInstant("soon")).toBeNull();
  });

  it("counts each email on the day it goes, once per recipient, never a cancelled one", () => {
    const days = emailsByDay([
      {
        createdAt: at("2026-11-04T13:27:00Z"),
        scheduledAt: null,
        cancelled: false,
        recipients: 1,
      },
      // A reminder made today for tomorrow counts tomorrow.
      {
        createdAt: at("2026-11-04T20:00:00Z"),
        scheduledAt: at("2026-11-05T09:50:00Z"),
        cancelled: false,
        recipients: 1,
      },
      {
        createdAt: at("2026-11-04T21:00:00Z"),
        scheduledAt: at("2026-11-05T10:00:00Z"),
        cancelled: true,
        recipients: 1,
      },
      // Another app's email to three people counts three times.
      {
        createdAt: at("2026-11-04T22:00:00Z"),
        scheduledAt: null,
        cancelled: false,
        recipients: 3,
      },
    ]);
    expect(Object.fromEntries(days)).toEqual({
      "2026-11-04": 4,
      "2026-11-05": 1,
    });
  });
});
