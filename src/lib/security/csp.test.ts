import { describe, expect, it } from "vitest";

import { providerRequest, PROVIDERS } from "@/lib/notes/providers";

import {
  AI_PROVIDER_SOURCES,
  contentSecurityPolicy,
  cspDirectives,
  cspMode,
  dsnOrigin,
  STREAM_SOURCES,
  TURNSTILE_SOURCE,
  type CspOptions,
} from "./csp";

const base: CspOptions = {
  mode: "report-only",
  development: false,
  turnstile: false,
};
const directive = (options: CspOptions, name: string) =>
  cspDirectives(options).find(([key]) => key === name)?.[1];

/** Whether a CSP source expression (with an optional *. host wildcard) allows a URL. */
function allows(source: string, url: string): boolean {
  const target = new URL(url);
  const match = /^([a-z]+):\/\/(\*\.)?(.+)$/.exec(source);
  if (!match) return false;
  const [, scheme, wildcard, host] = match;
  if (`${scheme}:` !== target.protocol) return false;
  return wildcard ? target.hostname.endsWith(`.${host}`) : target.host === host;
}

describe("contentSecurityPolicy", () => {
  it("allows inline scripts and WebAssembly, but never eval in production", () => {
    expect(directive(base, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
    ]);
    expect(directive({ ...base, development: true }, "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  it("lets the browser reach every AI provider a host's key calls", () => {
    const connect = directive(base, "connect-src") ?? [];
    expect(connect).toEqual(expect.arrayContaining([...AI_PROVIDER_SOURCES]));
    for (const provider of PROVIDERS) {
      const { url } = providerRequest({
        provider,
        key: "k",
        model: "m",
        system: "s",
        prompt: "p",
      });
      expect(
        AI_PROVIDER_SOURCES.some((source) => allows(source, url)),
        url,
      ).toBe(true);
    }
  });

  it("lets Stream's API, WebSocket and call servers through", () => {
    for (const url of [
      "https://video.stream-io-api.com/video/call/default/abc",
      "wss://video.stream-io-api.com/video/connect",
      "https://sfu-9c0dc03.fra1.stream-io-video.com/twirp",
      "wss://sfu-9c0dc03.fra1.stream-io-video.com/ws",
      "https://hint.stream-io-video.com/",
    ]) {
      expect(
        STREAM_SOURCES.some((source) => allows(source, url)),
        url,
      ).toBe(true);
    }
  });

  it("adds Turnstile and the error reports' host only when they're on", () => {
    expect(directive(base, "frame-src")).toEqual(["'none'"]);
    const on = { ...base, turnstile: true };
    expect(directive(on, "frame-src")).toEqual([TURNSTILE_SOURCE]);
    expect(directive(on, "script-src")).toContain(TURNSTILE_SOURCE);
    const reports = {
      ...base,
      sentryDsn: "https://abc123@o456.ingest.de.sentry.io/789",
    };
    expect(directive(reports, "connect-src")).toContain(
      "https://o456.ingest.de.sentry.io",
    );
  });

  it("keeps frame-ancestors and upgrade-insecure-requests for an enforced policy", () => {
    const reportOnly = contentSecurityPolicy(base);
    expect(reportOnly).not.toContain("frame-ancestors");
    expect(reportOnly).not.toContain("upgrade-insecure-requests");
    const enforced = contentSecurityPolicy({ ...base, mode: "enforce" });
    expect(enforced).toContain("frame-ancestors 'none'");
    expect(enforced).toContain("upgrade-insecure-requests");
  });

  it("reports violations and shuts plugins and other bases out", () => {
    const policy = contentSecurityPolicy(base);
    expect(policy).toContain("report-uri /api/csp-report");
    expect(policy).toContain("report-to csp");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).not.toMatch(/;\s*;/);
  });
});

describe("dsnOrigin", () => {
  it("takes a DSN's origin and ignores anything else", () => {
    expect(dsnOrigin("https://key@glitchtip.example.org/3")).toBe(
      "https://glitchtip.example.org",
    );
    expect(dsnOrigin(undefined)).toBeNull();
    expect(dsnOrigin("not a dsn")).toBeNull();
    expect(dsnOrigin("javascript:alert(1)")).toBeNull();
  });
});

describe("cspMode", () => {
  it("reports only, unless set to enforce or off", () => {
    expect(cspMode(undefined)).toBe("report-only");
    expect(cspMode("enforce")).toBe("enforce");
    expect(cspMode("off")).toBe("off");
    expect(cspMode("yes")).toBe("report-only");
  });
});
