import { describe, expect, it } from "vitest";

import { ASK_AGAIN_AFTER_DAYS, hostingAccess, RequestNote } from "./rules";

const now = new Date("2026-11-02T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("hostingAccess", () => {
  it("lets a demo host who never asked ask", () => {
    expect(hostingAccess({ plan: "demo", latest: null, now })).toEqual({
      plan: "demo",
      ask: "available",
    });
  });

  it("shows an open request as pending", () => {
    expect(
      hostingAccess({
        plan: "demo",
        latest: { status: "pending", decidedAt: null, seenAt: null },
        now,
      }),
    ).toEqual({ plan: "demo", ask: "pending" });
  });

  it("waits after a decline, then lets them ask again", () => {
    const declined = (days: number) =>
      hostingAccess({
        plan: "demo",
        latest: { status: "declined", decidedAt: daysAgo(days), seenAt: null },
        now,
      });
    const recent = declined(3);
    expect(recent).toMatchObject({ plan: "demo", ask: "declined" });
    expect(
      recent.plan === "demo" && recent.ask === "declined"
        ? recent.askAgainAt.getTime()
        : 0,
    ).toBe(daysAgo(3 - ASK_AGAIN_AFTER_DAYS).getTime());
    expect(declined(ASK_AGAIN_AFTER_DAYS + 1)).toEqual({
      plan: "demo",
      ask: "available",
    });
  });

  it("lets someone moved back to demos ask again", () => {
    expect(
      hostingAccess({
        plan: "demo",
        latest: { status: "approved", decidedAt: daysAgo(5), seenAt: now },
        now,
      }),
    ).toEqual({ plan: "demo", ask: "available" });
  });

  it("says once that an admin approved them", () => {
    const approved = { status: "approved" as const, decidedAt: daysAgo(1) };
    expect(
      hostingAccess({
        plan: "full",
        latest: { ...approved, seenAt: null },
        now,
      }),
    ).toEqual({ plan: "full", justApproved: true });
    expect(
      hostingAccess({
        plan: "full",
        latest: { ...approved, seenAt: now },
        now,
      }),
    ).toEqual({ plan: "full", justApproved: false });
    // Approved by the operator's settings: nothing to announce.
    expect(hostingAccess({ plan: "full", latest: null, now })).toEqual({
      plan: "full",
      justApproved: false,
    });
  });
});

describe("RequestNote", () => {
  it("trims, and allows up to 500 characters", () => {
    expect(RequestNote.parse("  Book club  ")).toBe("Book club");
    expect(RequestNote.safeParse("x".repeat(501)).success).toBe(false);
  });
});
