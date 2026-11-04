import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cancelScheduledEmail, sendEmail, type Email } from "./send";

vi.mock("@/lib/server-env", () => ({
  serverEnv: () => ({
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "FaceOn <no-reply@example.com>",
  }),
}));

const fetchMock = vi.fn<typeof fetch>();
const email: Email = {
  to: "alex@example.com",
  subject: "Weekly design review starts in 10 minutes",
  text: "Join",
  html: "<p>Join</p>",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const sentRequest = () => {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return {
    url,
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
};

describe("sending an email", () => {
  it("schedules it with Resend, keyed so a retry can't make a second", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-1" }));
    const id = await sendEmail(email, {
      scheduledAt: new Date("2026-11-10T14:50:00Z"),
      idempotencyKey: "reminder/abc",
    });
    expect(id).toBe("email-1");
    const request = sentRequest();
    expect(request.url).toBe("https://api.resend.com/emails");
    expect(request.headers["Idempotency-Key"]).toBe("reminder/abc");
    expect(request.body.scheduled_at).toBe("2026-11-10T14:50:00.000Z");
    expect(request.body.to).toEqual(["alex@example.com"]);
  });

  it("sends it now when there's no time", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-2" }));
    await sendEmail(email);
    const request = sentRequest();
    expect(request.body).not.toHaveProperty("scheduled_at");
    expect(request.headers).not.toHaveProperty("Idempotency-Key");
  });

  it("fails when Resend refuses it", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    await expect(sendEmail(email)).rejects.toThrow("HTTP 429");
  });
});

describe("cancelling a scheduled email", () => {
  const notScheduled = () =>
    Response.json(
      { statusCode: 422, message: "Email is not scheduled" },
      { status: 422 },
    );

  it("is done once Resend cancels it, or has no such email", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: "email-1" }));
    expect(await cancelScheduledEmail("email-1")).toBe("cancelled");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.resend.com/emails/email-1/cancel",
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await cancelScheduledEmail("email-1")).toBe("cancelled");
  });

  it("tells an email that went from one still being scheduled", async () => {
    fetchMock
      .mockResolvedValueOnce(notScheduled())
      .mockResolvedValueOnce(Response.json({ last_event: "delivered" }));
    expect(await cancelScheduledEmail("email-1")).toBe("sent");

    fetchMock
      .mockResolvedValueOnce(notScheduled())
      .mockResolvedValueOnce(Response.json({ last_event: "scheduled" }));
    expect(await cancelScheduledEmail("email-1")).toBe("retry");

    fetchMock
      .mockResolvedValueOnce(notScheduled())
      .mockResolvedValueOnce(Response.json({ last_event: "canceled" }));
    expect(await cancelScheduledEmail("email-1")).toBe("cancelled");
  });

  it("tries again later when Resend can't be reached or is busy", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await cancelScheduledEmail("email-1")).toBe("retry");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect(await cancelScheduledEmail("email-1")).toBe("retry");
  });
});
