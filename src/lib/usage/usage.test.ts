import { describe, expect, it } from "vitest";

import { readNeonProject } from "./neon";
import { readingsOf, type UsageReport } from "./usage";

const report = (changes: Partial<UsageReport> = {}): UsageReport => ({
  month: "2026-11",
  stream: {
    configured: true,
    minutes: 1200.5,
    limit: 333_000,
    countedAt: new Date("2026-11-04T09:30:00Z"),
  },
  emails: {
    configured: true,
    today: { sent: 3, resend: null },
    yesterday: { sent: 90, resend: 95, day: "2026-11-03" },
    month: { sent: 400, resend: 380 },
    account: { via: "list", at: new Date("2026-11-04T09:28:00Z") },
    listing: "ok",
    perDay: 100,
    perMonth: 3000,
  },
  neon: {
    state: "ok",
    cuHours: 50,
    periodStart: new Date("2026-11-01T00:00:00Z"),
    periodEnd: new Date("2026-12-01T00:00:00Z"),
    readAt: new Date("2026-11-04T09:27:00Z"),
    limit: 100,
  },
  ...changes,
});

describe("Neon's project details", () => {
  it("reads compute hours from CU-seconds, with the billing period", () => {
    expect(
      readNeonProject({
        project: {
          id: "spring-example-302709",
          compute_time_seconds: 180_000,
          active_time_seconds: 720_000,
          consumption_period_start: "2026-11-01T00:00:00Z",
          consumption_period_end: "2026-12-01T00:00:00Z",
        },
      }),
    ).toEqual({
      state: "ok",
      cuHours: 50,
      periodStart: new Date("2026-11-01T00:00:00Z"),
      periodEnd: new Date("2026-12-01T00:00:00Z"),
    });
  });

  it("does without a period, and treats anything else as unavailable", () => {
    expect(
      readNeonProject({ project: { compute_time_seconds: 3600 } }),
    ).toMatchObject({ state: "ok", cuHours: 1, periodStart: null });
    expect(readNeonProject({ message: "unauthorized" })).toEqual({
      state: "unavailable",
    });
    expect(
      readNeonProject({ project: { compute_time_seconds: "lots" } }),
    ).toEqual({ state: "unavailable" });
  });
});

describe("what the daily sweep checks", () => {
  it("reads every meter that's set up", () => {
    expect(readingsOf(report())).toEqual([
      { meter: "stream", period: "2026-11", used: 1200.5, limit: 333_000 },
      {
        meter: "emailsDay",
        period: "2026-11",
        used: 95,
        limit: 100,
        day: "2026-11-03",
      },
      { meter: "emailsMonth", period: "2026-11", used: 400, limit: 3000 },
      { meter: "neon", period: "2026-11-01", used: 50, limit: 100 },
    ]);
  });

  it("leaves out what isn't set up", () => {
    const readings = readingsOf(
      report({
        stream: {
          configured: false,
          minutes: 0,
          limit: 333_000,
          countedAt: new Date(),
        },
        emails: { ...report().emails, configured: false },
        neon: { state: "unconfigured", limit: 100 },
      }),
    );
    expect(readings).toEqual([]);
    expect(
      readingsOf(report({ neon: { state: "unavailable", limit: 100 } })).map(
        (reading) => reading.meter,
      ),
    ).toEqual(["stream", "emailsDay", "emailsMonth"]);
  });
});
