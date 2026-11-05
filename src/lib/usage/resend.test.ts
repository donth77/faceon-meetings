import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/monitoring/report";

import { listResendEmails, refreshResendCounts } from "./resend";

// Settings, error reports and the kept reading as stand-ins, for refreshing the counts.
const stand = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  reading: null as { data: Record<string, unknown>; readAt: Date } | null,
  saved: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/server-env", () => ({ serverEnv: () => stand.env }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));
vi.mock("./readings", () => ({
  isFresh: () => false,
  lastReading: async () => stand.reading,
  saveReading: async (_source: string, data: Record<string, unknown>) => {
    stand.saved.push(data);
  },
}));

type Item = {
  id: string;
  created_at: string;
  scheduled_at?: string | null;
  last_event?: string;
  to?: string[];
};

/** Resend's list endpoint as a stand-in, newest first, `size` to a page. */
function listing(items: Item[], size = 2) {
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      const url = new URL(input);
      calls.push(url);
      const after = url.searchParams.get("after");
      const start = after
        ? items.findIndex((item) => item.id === after) + 1
        : 0;
      const data = items.slice(start, start + size);
      return Response.json({
        object: "list",
        has_more: start + size < items.length,
        data,
      });
    }),
  );
  return calls;
}

const email = (id: string, created: string, more: Partial<Item> = {}) => ({
  id,
  created_at: created,
  scheduled_at: null,
  last_event: "delivered",
  to: ["someone@example.com"],
  ...more,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listing the account's emails", () => {
  it("pages back until it reaches the start, keeping only counts and times", async () => {
    const calls = listing([
      email("e5", "2026-11-04 13:27:37.47+00"),
      email("e4", "2026-11-04 13:25:44.387+00", {
        scheduled_at: "2026-11-04 13:29:00+00",
      }),
      email("e3", "2026-11-02 09:00:00+00", { last_event: "canceled" }),
      email("e2", "2026-10-30 12:00:00+00"),
      email("e1", "2026-10-01 12:00:00+00"),
    ]);
    const listed = await listResendEmails(
      "re_test",
      new Date("2026-10-29T00:00:00Z"),
    );
    // The page holding the first email older than the start is the last one asked for.
    expect(calls.map((url) => url.searchParams.get("after"))).toEqual([
      null,
      "e4",
      "e2",
    ]);
    expect(calls[0]?.searchParams.get("limit")).toBe("100");
    expect(Array.isArray(listed) && listed.length).toBe(5);
    if (!Array.isArray(listed)) return;
    expect(listed[1]).toEqual({
      createdAt: new Date("2026-11-04T13:25:44.387Z"),
      scheduledAt: new Date("2026-11-04T13:29:00Z"),
      cancelled: false,
      recipients: 1,
    });
    expect(listed[2]?.cancelled).toBe(true);
    expect(JSON.stringify(listed)).not.toContain("example.com");
  });

  it("says when the key can only send, or Resend doesn't answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { name: "restricted_api_key", message: "This API key can only send" },
          { status: 401 },
        ),
      ),
    );
    expect(await listResendEmails("re_send_only", new Date())).toEqual({
      listing: "restricted",
      answer: 401,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 500 })),
    );
    expect(await listResendEmails("re_test", new Date())).toEqual({
      listing: "unavailable",
      answer: 500,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await listResendEmails("re_test", new Date())).toEqual({
      listing: "unavailable",
      answer: "none",
    });
  });

  it("asks once more, when Resend says, after too many requests", async () => {
    vi.useFakeTimers();
    try {
      const page = Response.json({ object: "list", has_more: false, data: [] });
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response("slow down", {
            status: 429,
            headers: { "retry-after": "1" },
          }),
        )
        .mockResolvedValueOnce(page);
      vi.stubGlobal("fetch", fetch);
      const listed = listResendEmails("re_test", new Date());
      await vi.advanceTimersByTimeAsync(999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await listed).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up when Resend still says too many", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("slow down", { status: 429 })),
      );
      const listed = listResendEmails("re_test", new Date());
      await vi.advanceTimersByTimeAsync(1000);
      expect(await listed).toEqual({ listing: "unavailable", answer: 429 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("refreshing Resend's counts", () => {
  const now = new Date("2026-11-04T16:00:00Z");
  const sendOnly = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            name: "restricted_api_key",
            message: "This API key is restricted to only send emails",
          },
          { status: 401 },
        ),
      ),
    );

  beforeEach(() => {
    stand.env = {};
    stand.reading = null;
    stand.saved = [];
    vi.mocked(reportError).mockClear();
  });

  it("stays quiet when the sending key can't list, as most copies' can't", async () => {
    stand.env = { RESEND_API_KEY: "re_send_only" };
    sendOnly();
    expect(await refreshResendCounts(now)).toBe("restricted");
    expect(stand.saved).toEqual([{ listing: "restricted" }]);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports a usage key that can't list, once", async () => {
    stand.env = {
      RESEND_API_KEY: "re_send_only",
      RESEND_USAGE_API_KEY: "re_usage",
    };
    sendOnly();
    expect(await refreshResendCounts(now)).toBe("restricted");
    expect(reportError).toHaveBeenCalledWith(
      "Couldn't list Resend's emails for the usage meter.",
      undefined,
      { state: "restricted", answer: 401, key: "RESEND_USAGE_API_KEY" },
    );
    // The next try finds the same outcome kept, and says nothing more.
    stand.reading = { data: { listing: "restricted" }, readAt: now };
    expect(await refreshResendCounts(now)).toBe("restricted");
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it("reports Resend not answering", async () => {
    stand.env = { RESEND_API_KEY: "re_full_access" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 500 })),
    );
    expect(await refreshResendCounts(now)).toBe("unavailable");
    expect(reportError).toHaveBeenCalledWith(
      "Couldn't list Resend's emails for the usage meter.",
      undefined,
      { state: "unavailable", answer: 500, key: "RESEND_API_KEY" },
    );
  });

  it("shares one listing among everything that asks while it's under way", async () => {
    stand.env = { RESEND_API_KEY: "re_full_access" };
    const fetch = vi.fn(async () => new Response("busy", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const both = await Promise.all([
      refreshResendCounts(now),
      refreshResendCounts(now),
    ]);
    expect(both).toEqual(["unavailable", "unavailable"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
    // Once it's done, the next one asks Resend again.
    await refreshResendCounts(now);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
