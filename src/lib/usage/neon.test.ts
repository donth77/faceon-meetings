import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/monitoring/report";

import { neonRefusal, neonUsage } from "./neon";

// Settings, error reports and the kept reading as stand-ins.
const stand = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
}));
vi.mock("@/lib/server-env", () => ({ serverEnv: () => stand.env }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));
vi.mock("./readings", () => ({
  isFresh: () => false,
  lastReading: async () => null,
  saveReading: async () => {},
}));

const PROJECT = "misty-river-12345678";
const BRANCH = "br-quiet-lake-a1b2c3d4";

/** Neon's API as a stand-in, answering every request with this. */
const neonAnswers = (status: number, body: unknown = {}) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(body, { status })),
  );

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what a refusal from Neon says", () => {
  it("gives the status, and the setting that's likely wrong", () => {
    expect(neonRefusal(401, PROJECT)).toBe(
      "Neon's API refused a request (401). Check NEON_API_KEY.",
    );
    expect(neonRefusal(404, PROJECT)).toBe(
      "Neon's API refused a request (404). Check NEON_PROJECT_ID, and that NEON_API_KEY is for that project.",
    );
    expect(neonRefusal(500, PROJECT)).toBe(
      "Neon's API refused a request (500).",
    );
  });

  it("says when NEON_PROJECT_ID holds a branch ID", () => {
    const said = neonRefusal(404, BRANCH);
    expect(said).toContain("(404)");
    expect(said).toContain("NEON_PROJECT_ID holds a branch ID (br-…)");
    expect(said).toContain("Settings → General");
  });
});

describe("the database's compute hours", () => {
  it("reports a refusal with its status, and shows the meter as unavailable", async () => {
    stand.env = { NEON_API_KEY: "napi_test", NEON_PROJECT_ID: BRANCH };
    neonAnswers(404, { message: "not found" });
    expect(await neonUsage()).toEqual({ state: "unavailable" });
    expect(reportError).toHaveBeenCalledWith(
      neonRefusal(404, BRANCH),
      undefined,
      { status: 404 },
    );
  });

  it("reads Neon's answer in CU-hours", async () => {
    stand.env = { NEON_API_KEY: "napi_test", NEON_PROJECT_ID: PROJECT };
    neonAnswers(200, {
      project: {
        compute_time_seconds: 7200,
        consumption_period_start: "2026-11-01T00:00:00Z",
        consumption_period_end: "2026-12-01T00:00:00Z",
      },
    });
    const now = new Date("2026-11-04T16:00:00Z");
    expect(await neonUsage(now)).toEqual({
      state: "ok",
      cuHours: 2,
      periodStart: new Date("2026-11-01T00:00:00Z"),
      periodEnd: new Date("2026-12-01T00:00:00Z"),
      readAt: now,
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("asks nothing without both settings", async () => {
    stand.env = { NEON_API_KEY: "napi_test" };
    neonAnswers(500);
    expect(await neonUsage()).toEqual({ state: "unconfigured" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
