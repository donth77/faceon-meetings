import { describe, expect, it } from "vitest";

import {
  blockedSource,
  parseCspReport,
  reportLimiter,
  violationLine,
} from "./csp-report";

const SESSION = "0b0f9c1e-5a4b-4c3d-9e8f-7a6b5c4d3e2f";

describe("parseCspReport", () => {
  it("reads report-uri's format, keeping no query, fragment, ID or code", () => {
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://joinfaceon.app/j/1234567890?x=1#pwd=SECRET",
        "violated-directive": "connect-src 'self'",
        "effective-directive": "connect-src",
        "blocked-uri": "https://tracker.example.com/pixel?id=me",
        disposition: "report",
        "script-sample": "alert(document.cookie)",
      },
    });
    const violations = parseCspReport("application/csp-report", body);
    expect(violations).toEqual([
      {
        directive: "connect-src",
        blocked: "https://tracker.example.com",
        page: "/j/:code",
        disposition: "report",
      },
    ]);
    const line = violationLine(violations![0]!);
    expect(line).not.toMatch(/SECRET|1234567890|pixel|alert/);
  });

  it("reads the Reporting API's batches, keeping only CSP reports", () => {
    const body = JSON.stringify([
      {
        type: "csp-violation",
        url: `https://joinfaceon.app/previous/${SESSION}/notes`,
        body: {
          documentURL: `https://joinfaceon.app/previous/${SESSION}/notes`,
          effectiveDirective: "script-src-elem",
          blockedURL: "inline",
          disposition: "enforce",
        },
      },
      { type: "deprecation", body: { message: "something old" } },
    ]);
    expect(parseCspReport("application/reports+json", body)).toEqual([
      {
        directive: "script-src-elem",
        blocked: "inline",
        page: "/previous/:session/notes",
        disposition: "enforce",
      },
    ]);
  });

  it("turns away what isn't a report", () => {
    expect(parseCspReport("application/json", "not json")).toBeNull();
    expect(parseCspReport("application/json", '{"hello":1}')).toBeNull();
    const tooMany = JSON.stringify(new Array(101).fill({ type: "x" }));
    expect(parseCspReport(null, tooMany)).toBeNull();
  });
});

describe("blockedSource", () => {
  it("keeps keywords and schemes, and only the origin of an address", () => {
    expect(blockedSource("eval")).toBe("eval");
    expect(blockedSource("wasm-eval")).toBe("wasm-eval");
    expect(blockedSource("data")).toBe("data");
    expect(blockedSource("blob:https://joinfaceon.app/1f2e")).toBe("blob:");
    expect(blockedSource("wss://sfu-1.stream-io-video.com/ws?token=abc")).toBe(
      "wss://sfu-1.stream-io-video.com",
    );
    expect(blockedSource("")).toBe("unknown");
    expect(blockedSource("<script>")).toBe("unknown");
  });
});

describe("reportLimiter", () => {
  it("lets a few through a minute, per visitor and in all", () => {
    let now = 0;
    const allowed = reportLimiter({ perSource: 2, total: 3 }, () => now);
    expect([allowed("a"), allowed("a"), allowed("a")]).toEqual([
      true,
      true,
      false,
    ]);
    expect([allowed("b"), allowed("c")]).toEqual([true, false]);
    now = 60_000;
    expect(allowed("a")).toBe(true);
  });
});
