import { describe, expect, it } from "vitest";

import { fingerprintOf, idempotencyKey } from "./fingerprint";

const email = {
  to: "alex@example.com",
  subject: "Weekly design review starts in 10 minutes",
  text: "Join FaceOn meeting",
  html: "<p>Join FaceOn meeting</p>",
  headers: { "List-Unsubscribe": "<https://faceon.example.com/stop>" },
};

describe("an email's fingerprint", () => {
  it("is the same for the same email", () => {
    expect(fingerprintOf({ ...email })).toBe(fingerprintOf(email));
  });

  it("changes with anything the email says or where it goes", () => {
    const seen = new Set([
      fingerprintOf(email),
      fingerprintOf({ ...email, to: "sam@example.com" }),
      fingerprintOf({
        ...email,
        subject: "Design review starts in 10 minutes",
      }),
      fingerprintOf({ ...email, text: "Join" }),
      fingerprintOf({ ...email, html: "<p>Join</p>" }),
      fingerprintOf({ ...email, headers: undefined }),
    ]);
    expect(seen.size).toBe(6);
  });
});

describe("Resend's key for a scheduled reminder", () => {
  const key = {
    userId: "user-1",
    meetingCode: "4815162342",
    startsAt: new Date("2026-11-10T15:00:00Z"),
  };

  it("is the same for a retry of the same email", () => {
    expect(idempotencyKey(key, "n1")).toBe(idempotencyKey({ ...key }, "n1"));
  });

  it("is new for an email made again, so it isn't the cancelled one", () => {
    expect(idempotencyKey(key, "n2")).not.toBe(idempotencyKey(key, "n1"));
  });

  it("fits Resend's limit", () => {
    expect(idempotencyKey(key, "n1").length).toBeLessThanOrEqual(256);
  });
});
