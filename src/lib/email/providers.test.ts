import { describe, expect, it, vi } from "vitest";

import { failureOf, mailbox, shouldFallBack } from "./providers";

vi.mock("@/lib/server-env", () => ({ serverEnv: () => ({}) }));

describe("email providers", () => {
  it("tells a limit and an outage, worth another provider, from a refusal", () => {
    expect(failureOf(429)).toBe("quota");
    expect(failureOf(500)).toBe("unavailable");
    expect(failureOf(503)).toBe("unavailable");
    expect(failureOf(400)).toBe("refused");
    expect(failureOf(401)).toBe("refused");
    expect(failureOf(422)).toBe("refused");
    expect(shouldFallBack("quota")).toBe(true);
    expect(shouldFallBack("unavailable")).toBe(true);
    expect(shouldFallBack("refused")).toBe(false);
  });

  it("reads a sender as an address and a name", () => {
    expect(mailbox("FaceOn <no-reply@example.com>")).toEqual({
      email: "no-reply@example.com",
      name: "FaceOn",
    });
    expect(mailbox('"FaceOn, Meetings" <no-reply@example.com>')).toEqual({
      email: "no-reply@example.com",
      name: "FaceOn, Meetings",
    });
    expect(mailbox(" no-reply@example.com ")).toEqual({
      email: "no-reply@example.com",
    });
    expect(mailbox("<no-reply@example.com>")).toEqual({
      email: "no-reply@example.com",
    });
  });
});
