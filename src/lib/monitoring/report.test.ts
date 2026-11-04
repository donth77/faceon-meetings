import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CspViolation } from "@/lib/security/csp-report";

const sentry = vi.hoisted(() => {
  const scope = {
    setTag: vi.fn(),
    setTags: vi.fn(),
    setFingerprint: vi.fn(),
  };
  return {
    scope,
    withScope: vi.fn((callback: (current: typeof scope) => void) =>
      callback(scope),
    ),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    flush: vi.fn(async () => true),
  };
});
vi.mock("@sentry/nextjs", () => sentry);

const sending = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("@vercel/functions", () => ({
  waitUntil: (promise: Promise<unknown>) => {
    sending.push(promise);
  },
}));

/** A fresh copy of the module, so each test starts with no CSP reports sent. */
async function load() {
  vi.resetModules();
  return import("./report");
}

const sent = () => Promise.all(sending.splice(0));

const log = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  vi.stubEnv(
    "NEXT_PUBLIC_SENTRY_DSN",
    "https://key@example.ingest.sentry.io/1",
  );
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.clearAllMocks();
  sending.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A database error the way Drizzle throws it: the query's values in the message. */
function failedQuery() {
  const cause = Object.assign(new Error("relation does not exist"), {
    code: "42P01",
  });
  return new Error(
    'Failed query: select * from "user" where "email" = $1\nparams: ada@example.com',
    { cause },
  );
}

describe("reportError", () => {
  it("logs a caught error and reports it, tagged and grouped by what failed", async () => {
    const { reportError } = await load();
    const error = new Error("Stream is down");
    reportError("Meeting API request failed", error);
    await sent();

    expect(log).toHaveBeenCalledWith("Meeting API request failed", error);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.scope.setTag).toHaveBeenCalledWith(
      "failed",
      "Meeting API request failed",
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      "{{ default }}",
      "Meeting API request failed",
    ]);
    expect(sentry.flush).toHaveBeenCalled();
  });

  it("reports a failed query without the values it ran with", async () => {
    const { reportError } = await load();
    reportError("Sweep could not check a session", failedQuery());
    await sent();

    const [reported] = sentry.captureException.mock.calls[0] as [Error];
    expect(reported.message).toBe("relation does not exist");
    expect(reported.stack).toContain("relation does not exist");
    expect(reported.stack).toContain("    at ");
    expect(`${reported.message}${reported.stack}`).not.toContain(
      "ada@example.com",
    );
    expect(sentry.scope.setTag).toHaveBeenCalledWith("db_code", "42P01");
    expect(JSON.stringify(log.mock.calls)).not.toContain("ada@example.com");
  });

  it("reports a failure without an Error as a message, with its details as tags", async () => {
    const { reportError } = await load();
    reportError("Neon's API refused a request.", undefined, { status: 401 });
    await sent();

    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "Neon's API refused a request.",
      "error",
    );
    expect(sentry.scope.setTag).toHaveBeenCalledWith("status", "401");
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      "Neon's API refused a request.",
    ]);
  });

  it("keeps a reason that isn't an Error in the log only", async () => {
    const { reportError } = await load();
    reportError(
      "The Apps Script API refused a request.",
      "Project 123 is gone",
    );
    await sent();

    expect(log).toHaveBeenCalledWith(
      "The Apps Script API refused a request.",
      "Project 123 is gone",
    );
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "The Apps Script API refused a request.",
      "error",
    );
    expect(JSON.stringify(sentry.captureMessage.mock.calls)).not.toContain(
      "Project 123",
    );
  });

  it("only logs without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { reportError } = await load();
    reportError("Meeting API request failed", new Error("down"));

    expect(log).toHaveBeenCalled();
    expect(sending).toHaveLength(0);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("only logs outside the Node.js server", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { reportError } = await load();
    reportError("Meeting API request failed", new Error("down"));

    expect(sending).toHaveLength(0);
  });
});

describe("reportCspViolation", () => {
  const violation: CspViolation = {
    directive: "script-src",
    blocked: "https://evil.example",
    page: "/j/:code",
    disposition: "report",
  };

  it("sends a warning tagged with the rule, the source and the page", async () => {
    const { reportCspViolation } = await load();
    reportCspViolation(violation, 0);
    await sent();

    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "Content Security Policy would block https://evil.example (script-src)",
      "warning",
    );
    expect(sentry.scope.setTags).toHaveBeenCalledWith({
      csp_directive: "script-src",
      csp_blocked: "https://evil.example",
      csp_page: "/j/:code",
      csp_disposition: "report",
    });
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      "csp",
      "script-src",
      "https://evil.example",
    ]);
  });

  it("sends each kind once an hour", async () => {
    const { reportCspViolation } = await load();
    reportCspViolation(violation, 0);
    reportCspViolation(violation, 59 * 60_000);
    reportCspViolation({ ...violation, page: "/" }, 59 * 60_000);
    reportCspViolation(violation, 60 * 60_000);
    await sent();

    expect(sentry.captureMessage).toHaveBeenCalledTimes(3);
  });

  it("says when the policy blocked rather than only reported", async () => {
    const { reportCspViolation } = await load();
    reportCspViolation({ ...violation, disposition: "enforce" }, 0);
    await sent();

    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "Content Security Policy blocked https://evil.example (script-src)",
      "warning",
    );
  });

  it("sends nothing without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { reportCspViolation } = await load();
    reportCspViolation(violation, 0);

    expect(sending).toHaveLength(0);
  });
});
