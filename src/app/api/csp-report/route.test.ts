import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const reportCspViolation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/monitoring/report", () => ({ reportCspViolation }));

beforeEach(() => {
  reportCspViolation.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/csp-report", () => {
  it("passes each violation on to error reports as the log has it", async () => {
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://joinfaceon.app/j/1234567890?hl=en#pwd=K7XQ2M",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/tracker.js?token=secret",
        disposition: "report",
      },
    });
    const response = await POST(
      new Request("https://joinfaceon.app/api/csp-report", {
        method: "POST",
        headers: {
          "content-type": "application/csp-report",
          "x-forwarded-for": "203.0.113.9",
        },
        body,
      }),
    );

    expect(response.status).toBe(204);
    expect(reportCspViolation).toHaveBeenCalledWith({
      directive: "script-src-elem",
      blocked: "https://evil.example",
      page: "/j/:code",
      disposition: "report",
    });
    expect(JSON.stringify(reportCspViolation.mock.calls)).not.toMatch(
      /K7XQ2M|secret|1234567890|203\.0\.113\.9/,
    );
  });

  it("reports nothing for a body that isn't a report", async () => {
    const response = await POST(
      new Request("https://joinfaceon.app/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(response.status).toBe(400);
    expect(reportCspViolation).not.toHaveBeenCalled();
  });
});
