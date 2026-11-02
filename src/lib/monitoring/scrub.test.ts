import type { ErrorEvent } from "@sentry/browser";
import { describe, expect, it } from "vitest";

import { scrubBreadcrumb, scrubEvent } from "./scrub";

describe("scrubEvent", () => {
  it("removes who it happened to and what they sent", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "Could not join 1234567890 as ada@example.com",
      user: { id: "u1", email: "ada@example.com", ip_address: "203.0.113.4" },
      server_name: "ip-10-0-0-1",
      extra: { transcript: "what Ada said" },
      transaction: "/j/1234567890",
      request: {
        url: "https://joinfaceon.app/j/1234567890?x=1#pwd=K7XQ2M",
        data: { passcode: "K7XQ2M" },
        query_string: "x=1",
        cookies: { "better-auth.session_token": "cookie-value" },
        headers: { "User-Agent": "Chrome", Cookie: "a=b", Referer: "x" },
      },
      contexts: {
        browser: { name: "Chrome" },
        notes: { chat: "hello" },
      },
      exception: {
        values: [
          {
            type: "Error",
            value: "Bad key sk-abcdefghijklmnopqrstuvwxyz for ada@example.com",
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://joinfaceon.app/_next/static/chunks/a.js?v=1",
                  abs_path:
                    "https://joinfaceon.app/_next/static/chunks/a.js?v=1",
                  vars: { name: "Ada" },
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: [
        { category: "console", message: "Ada said hi" },
        { category: "ui.click", message: "button[aria-label=Options for Ada]" },
        {
          category: "navigation",
          data: { from: "/j/1234567890#pwd=K7XQ2M", to: "/home?x=1" },
        },
        {
          category: "fetch",
          data: {
            url: "/api/meetings/1234567890/join",
            method: "POST",
            status_code: 403,
            body: "{name: Ada}",
          },
        },
      ],
    };
    const scrubbed = scrubEvent(event);
    expect(JSON.stringify(scrubbed)).not.toMatch(
      /Ada|ada@|203\.0\.113|K7XQ2M|1234567890|cookie-value|sk-abc|ip-10|hello/,
    );
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toEqual({
      url: "https://joinfaceon.app/j/:code",
      headers: { "User-Agent": "Chrome" },
    });
    expect(scrubbed.contexts).toEqual({ browser: { name: "Chrome" } });
    expect(scrubbed.transaction).toBe("/j/:code");
    expect(scrubbed.breadcrumbs).toEqual([
      { category: "navigation", data: { from: "/j/:code", to: "/home" } },
      {
        category: "fetch",
        data: {
          url: "/api/meetings/:code/join",
          method: "POST",
          status_code: 403,
        },
      },
    ]);
    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: "https://joinfaceon.app/_next/static/chunks/a.js",
      abs_path: "https://joinfaceon.app/_next/static/chunks/a.js",
    });
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console and interface breadcrumbs, and trims the rest", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
    expect(scrubBreadcrumb({ category: "ui.input" })).toBeNull();
    expect(
      scrubBreadcrumb({ category: "xhr", data: { url: "/a?b=1", body: "x" } }),
    ).toEqual({ category: "xhr", data: { url: "/a" } });
  });
});
