import { describe, expect, it, vi } from "vitest";

import { calendarApi, GoogleCalendarError, problemOf } from "./api";

const EVENTS =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** A fetch that answers every request with this status and body, and records calls. */
function answering(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(
    async (_url: URL | RequestInfo, _init?: RequestInit) =>
      new Response(status === 204 ? null : JSON.stringify(body), { status }),
  );
  return { fetchMock, api: calendarApi("ya29.token", fetchMock) };
}
const request = (fetchMock: ReturnType<typeof answering>["fetchMock"]) => {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: new URL(String(url)), init: init ?? {} };
};
const googleError = (status: number, reason: string, detail?: string) => ({
  error: {
    code: status,
    status: "PERMISSION_DENIED",
    errors: [{ reason }],
    ...(detail ? { details: [{ reason: detail }] } : {}),
  },
});

describe("calendarApi", () => {
  it("makes an event in the host's own calendar, and Google emails the guests", async () => {
    const { fetchMock, api } = answering(200, {
      id: "e1",
      status: "confirmed",
    });
    const made = await api.insert({ summary: "Product sync" }, "all");
    expect(made).toEqual({ id: "e1", status: "confirmed" });
    const { url, init } = request(fetchMock);
    expect(`${url.origin}${url.pathname}`).toBe(EVENTS);
    expect(url.searchParams.get("sendUpdates")).toBe("all");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ summary: "Product sync" });
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer ya29.token",
    );
  });

  it("changes and removes one event by its ID", async () => {
    const patching = answering(200, { id: "e1" });
    await patching.api.patch("e1_20261110T190000Z", { summary: "x" }, "none");
    const patched = request(patching.fetchMock);
    expect(patched.init.method).toBe("PATCH");
    expect(patched.url.pathname).toBe(
      "/calendar/v3/calendars/primary/events/e1_20261110T190000Z",
    );
    expect(patched.url.searchParams.get("sendUpdates")).toBe("none");

    const removing = answering(204);
    await removing.api.remove("e1", "all");
    expect(request(removing.fetchMock).init.method).toBe("DELETE");
  });

  it("lists a series' occurrences between two moments, cancelled ones too", async () => {
    const { fetchMock, api } = answering(200, {
      items: [{ id: "e1_20261110T190000Z", status: "cancelled" }],
    });
    const items = await api.instances(
      "e1",
      new Date("2026-11-09T19:00:00Z"),
      new Date("2026-11-18T20:00:00Z"),
    );
    expect(items).toHaveLength(1);
    const { url } = request(fetchMock);
    expect(url.pathname).toBe(
      "/calendar/v3/calendars/primary/events/e1/instances",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      timeMin: "2026-11-09T19:00:00Z",
      timeMax: "2026-11-18T20:00:00Z",
      showDeleted: "true",
      maxResults: "2500",
    });
  });

  it("turns Google's errors into problems FaceOn acts on", async () => {
    const cases: Array<[number, unknown, string]> = [
      [401, googleError(401, "authError"), "auth"],
      [
        403,
        googleError(
          403,
          "insufficientPermissions",
          "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
        ),
        "scope",
      ],
      [
        403,
        googleError(403, "accessNotConfigured", "SERVICE_DISABLED"),
        "disabled",
      ],
      [403, googleError(403, "rateLimitExceeded"), "limited"],
      [429, {}, "limited"],
      [404, googleError(404, "notFound"), "gone"],
      [410, googleError(410, "deleted"), "gone"],
      [400, googleError(400, "invalid"), "rejected"],
      [503, "<html>", "unavailable"],
    ];
    for (const [status, body, problem] of cases) {
      const { api } = answering(status, body);
      await expect(api.get("e1")).rejects.toMatchObject({ problem, status });
    }
  });

  it("treats a network failure or a strange answer as Google being unavailable", async () => {
    const offline = calendarApi("t", async () => {
      throw new TypeError("fetch failed");
    });
    await expect(offline.get("e1")).rejects.toMatchObject({
      problem: "unavailable",
    });
    const { api } = answering(200, { notAnEvent: true });
    const error = await api.get("e1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleCalendarError);
    expect(error).toMatchObject({ problem: "unavailable" });
  });
});

describe("problemOf", () => {
  it("reads the reason from either error shape", () => {
    expect(
      problemOf(403, { error: { details: [{ reason: "SERVICE_DISABLED" }] } }),
    ).toEqual({ problem: "disabled", reason: "SERVICE_DISABLED" });
    expect(problemOf(403, null)).toEqual({ problem: "rejected" });
  });
});
