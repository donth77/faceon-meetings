import { afterEach, describe, expect, it, vi } from "vitest";

import { lookUpMeeting, readLookup } from "./lookup";

describe("readLookup", () => {
  it("passes on the lookup's answer", () => {
    expect(readLookup(true, { meeting: "open" })).toBe("open");
    expect(readLookup(true, { meeting: "notFound" })).toBe("notFound");
    expect(readLookup(true, { meeting: "cancelled" })).toBe("cancelled");
    expect(readLookup(true, { meeting: "tooManyTries" })).toBe("tooManyTries");
  });

  it("calls anything else unknown, so the meeting's page decides", () => {
    expect(readLookup(false, { error: { code: "UNAVAILABLE" } })).toBe(
      "unknown",
    );
    expect(readLookup(true, { meeting: "somewhere" })).toBe("unknown");
    expect(readLookup(true, null)).toBe("unknown");
  });
});

describe("lookUpMeeting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the meeting API about the ID", async () => {
    const fetch = vi.fn(async () => Response.json({ meeting: "ended" }));
    vi.stubGlobal("fetch", fetch);
    await expect(lookUpMeeting("1234567890")).resolves.toBe("ended");
    expect(fetch).toHaveBeenCalledWith("/api/meetings/1234567890", {
      cache: "no-store",
    });
  });

  it("says when the server can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(lookUpMeeting("1234567890")).resolves.toBe("network");
  });
});
