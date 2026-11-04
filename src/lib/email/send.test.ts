import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelScheduledEmail,
  canScheduleEmail,
  canSendEmail,
  sendEmail,
  type Email,
} from "./send";

const env = vi.hoisted(() => ({
  RESEND_API_KEY: "re_test" as string | undefined,
  EMAIL_FROM: "FaceOn <no-reply@example.com>" as string | undefined,
  MAILTRAP_API_KEY: undefined as string | undefined,
  MAILTRAP_FROM: undefined as string | undefined,
}));
const usage = vi.hoisted(() => ({
  recordSentEmail: vi.fn<(headers: Headers, goesAt?: Date) => Promise<void>>(),
  recordMailtrapEmail: vi.fn<() => Promise<void>>(),
  resendSpent: vi.fn<() => Promise<boolean>>(),
}));
const reportError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server-env", () => ({ serverEnv: () => env }));
vi.mock("@/lib/usage/emails", () => usage);
vi.mock("@/lib/monitoring/report", () => ({ reportError }));

const RESEND = "https://api.resend.com/emails";
const MAILTRAP = "https://send.api.mailtrap.io/api/send";

const fetchMock = vi.fn<typeof fetch>();
const email: Email = {
  to: "alex@example.com",
  subject: "Weekly design review starts in 10 minutes",
  text: "Join",
  html: "<p>Join</p>",
};

beforeEach(() => {
  env.RESEND_API_KEY = "re_test";
  env.EMAIL_FROM = "FaceOn <no-reply@example.com>";
  env.MAILTRAP_API_KEY = undefined;
  env.MAILTRAP_FROM = undefined;
  usage.recordSentEmail.mockReset().mockResolvedValue(undefined);
  usage.recordMailtrapEmail.mockReset().mockResolvedValue(undefined);
  usage.resendSpent.mockReset().mockResolvedValue(false);
  reportError.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // A provider at its limit is noted in the server log.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(console.warn).mockRestore();
});

const withMailtrap = () => {
  env.MAILTRAP_API_KEY = "mt_test";
};

const request = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index] ?? [];
  return {
    url: String(url),
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
};
const urls = () => fetchMock.mock.calls.map(([url]) => String(url));

const refused = (status: number) => new Response(null, { status });
const mailtrapSent = () =>
  Response.json({ success: true, message_ids: ["mt-1"] });

describe("sending an email", () => {
  it("schedules it with Resend, keyed so a retry can't make a second", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-1" }));
    const id = await sendEmail(email, {
      scheduledAt: new Date("2026-11-10T14:50:00Z"),
      idempotencyKey: "reminder/abc",
    });
    expect(id).toBe("email-1");
    const sent = request();
    expect(sent.url).toBe(RESEND);
    expect(sent.headers["Idempotency-Key"]).toBe("reminder/abc");
    expect(sent.body.scheduled_at).toBe("2026-11-10T14:50:00.000Z");
    expect(sent.body.to).toEqual(["alex@example.com"]);
  });

  it("sends it now when there's no time", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-2" }));
    await sendEmail(email);
    const sent = request();
    expect(sent.body).not.toHaveProperty("scheduled_at");
    expect(sent.headers).not.toHaveProperty("Idempotency-Key");
  });

  it("counts what Resend sends, on the day it goes", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-1" }));
    const at = new Date("2026-11-10T14:50:00Z");
    await sendEmail(email, { scheduledAt: at });
    expect(usage.recordSentEmail).toHaveBeenCalledWith(expect.any(Headers), at);
  });

  it("fails when Resend refuses it and there's no backup", async () => {
    fetchMock.mockResolvedValue(refused(429));
    await expect(sendEmail(email)).rejects.toThrow("HTTP 429");
    expect(urls()).toEqual([RESEND]);
    expect(usage.resendSpent).not.toHaveBeenCalled();
  });
});

describe("falling back to Mailtrap", () => {
  beforeEach(withMailtrap);

  it("sends with Mailtrap when Resend is at its limit, and counts it apart", async () => {
    fetchMock
      .mockResolvedValueOnce(refused(429))
      .mockResolvedValueOnce(mailtrapSent());
    expect(await sendEmail(email)).toBe("mt-1");
    expect(urls()).toEqual([RESEND, MAILTRAP]);
    const sent = request(1);
    expect(sent.headers.Authorization).toBe("Bearer mt_test");
    expect(sent.body).toMatchObject({
      from: { email: "no-reply@example.com", name: "FaceOn" },
      to: [{ email: "alex@example.com" }],
      subject: email.subject,
      text: "Join",
      html: "<p>Join</p>",
    });
    // Each provider's count is for what it sent.
    expect(usage.recordMailtrapEmail).toHaveBeenCalledOnce();
    expect(usage.recordSentEmail).not.toHaveBeenCalled();
    // A limit is expected; it isn't an error.
    expect(reportError).not.toHaveBeenCalled();
  });

  it("sends with Mailtrap when Resend fails or can't be reached, and reports it", async () => {
    fetchMock
      .mockResolvedValueOnce(refused(503))
      .mockResolvedValueOnce(mailtrapSent());
    expect(await sendEmail(email)).toBe("mt-1");
    expect(reportError).toHaveBeenCalledWith(expect.any(String), undefined, {
      provider: "resend",
      status: 503,
    });

    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(mailtrapSent());
    expect(await sendEmail(email)).toBe("mt-1");
    expect(reportError).toHaveBeenLastCalledWith(
      expect.any(String),
      undefined,
      { provider: "resend", status: "unreachable" },
    );
  });

  it("doesn't pass on an email Resend turned down", async () => {
    fetchMock.mockResolvedValue(refused(422));
    await expect(sendEmail(email)).rejects.toThrow(
      "Resend refused it (HTTP 422)",
    );
    expect(urls()).toEqual([RESEND]);
  });

  it("names both when neither can send it", async () => {
    fetchMock
      .mockResolvedValueOnce(refused(429))
      .mockResolvedValueOnce(refused(500));
    await expect(sendEmail(email)).rejects.toThrow(
      "Resend refused it (HTTP 429); Mailtrap refused it (HTTP 500)",
    );
  });

  it("sends with its own sender when it has one", async () => {
    env.MAILTRAP_FROM = "no-reply@mail.example.com";
    fetchMock
      .mockResolvedValueOnce(refused(429))
      .mockResolvedValueOnce(mailtrapSent());
    await sendEmail(email);
    expect(request(1).body.from).toEqual({
      email: "no-reply@mail.example.com",
    });
  });

  it("tries Mailtrap first once the counts say Resend's allowance is used up", async () => {
    usage.resendSpent.mockResolvedValue(true);
    fetchMock.mockResolvedValue(mailtrapSent());
    expect(await sendEmail(email)).toBe("mt-1");
    expect(urls()).toEqual([MAILTRAP]);
  });

  it("still tries Resend last, whatever Mailtrap says, since the counts can be behind", async () => {
    usage.resendSpent.mockResolvedValue(true);
    fetchMock
      .mockResolvedValueOnce(refused(401))
      .mockResolvedValueOnce(Response.json({ id: "email-3" }));
    expect(await sendEmail(email)).toBe("email-3");
    expect(urls()).toEqual([MAILTRAP, RESEND]);
    expect(usage.recordSentEmail).toHaveBeenCalledOnce();
    expect(usage.recordMailtrapEmail).not.toHaveBeenCalled();
  });

  it("keeps reminders on Resend, which can schedule them", async () => {
    fetchMock.mockResolvedValue(refused(429));
    await expect(
      sendEmail(email, { scheduledAt: new Date("2026-11-10T14:50:00Z") }),
    ).rejects.toThrow("HTTP 429");
    expect(urls()).toEqual([RESEND]);
    expect(usage.resendSpent).not.toHaveBeenCalled();
  });
});

describe("what's set up", () => {
  it("sends with Mailtrap alone, but can't schedule with it", async () => {
    env.RESEND_API_KEY = undefined;
    withMailtrap();
    expect(canSendEmail()).toBe(true);
    expect(canScheduleEmail()).toBe(false);
    await expect(
      sendEmail(email, { scheduledAt: new Date("2026-11-10T14:50:00Z") }),
    ).rejects.toThrow("can schedule");
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(mailtrapSent());
    expect(await sendEmail(email)).toBe("mt-1");
  });

  it("can't send without a provider", async () => {
    env.RESEND_API_KEY = undefined;
    expect(canSendEmail()).toBe(false);
    expect(canScheduleEmail()).toBe(false);
    await expect(sendEmail(email)).rejects.toThrow("isn't configured");
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
