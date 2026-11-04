import { afterEach, describe, expect, it, vi } from "vitest";

import { listResendEmails } from "./resend";

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
    expect(await listResendEmails("re_send_only", new Date())).toBe(
      "restricted",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 500 })),
    );
    expect(await listResendEmails("re_test", new Date())).toBe("unavailable");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await listResendEmails("re_test", new Date())).toBe("unavailable");
  });
});
