import { describe, expect, it } from "vitest";

import {
  hostStatus,
  invitedEmail,
  inviteLink,
  inviteRefusal,
  INVITES_PER_ADDRESS,
  INVITES_PER_ADMIN_PER_DAY,
  RESEND_AFTER_MS,
  startOfUtcDay,
} from "./invites";

const now = new Date("2026-11-04T15:00:00Z");
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

describe("an approved address's status", () => {
  it("is Joined once its owner has signed up and verified it", () => {
    expect(hostStatus({ account: "verified", invitedAt: null })).toBe("joined");
    expect(hostStatus({ account: "verified", invitedAt: minutesAgo(5) })).toBe(
      "joined",
    );
  });

  it("is Invited after an invitation email, until then Approved", () => {
    expect(hostStatus({ account: "none", invitedAt: minutesAgo(5) })).toBe(
      "invited",
    );
    expect(hostStatus({ account: "none", invitedAt: null })).toBe("approved");
  });

  it("isn't Joined while the address is unverified: hosting waits for that", () => {
    expect(hostStatus({ account: "unverified", invitedAt: null })).toBe(
      "approved",
    );
  });
});

describe("an invite link", () => {
  it("opens sign-up with the address filled in, without a language in the path", () => {
    expect(inviteLink("https://joinfaceon.app", "Ana@Example.com")).toBe(
      "https://joinfaceon.app/sign-up?email=ana%40example.com",
    );
    expect(inviteLink("https://joinfaceon.app/", "a+b@example.com")).toBe(
      "https://joinfaceon.app/sign-up?email=a%2Bb%40example.com",
    );
  });

  it("fills in sign-up only with a real address", () => {
    expect(invitedEmail(" Ana@Example.com ")).toBe("ana@example.com");
    expect(invitedEmail("a+b@example.com")).toBe("a+b@example.com");
    expect(invitedEmail("not an address")).toBeNull();
    expect(invitedEmail("")).toBeNull();
    expect(invitedEmail(null)).toBeNull();
    expect(invitedEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });
});

describe("emailing an invitation", () => {
  const fresh = {
    account: "none" as const,
    inviteCount: 0,
    invitedAt: null,
    sentToday: 0,
    now,
  };

  it("goes to an approved address nobody has signed up with", () => {
    expect(inviteRefusal(fresh)).toBeNull();
  });

  it("never goes to someone who already has an account, verified or not", () => {
    expect(inviteRefusal({ ...fresh, account: "verified" })).toEqual({
      reason: "hasAccount",
    });
    expect(inviteRefusal({ ...fresh, account: "unverified" })).toEqual({
      reason: "hasAccount",
    });
  });

  it("waits an hour before the same address is emailed again", () => {
    const invitedAt = minutesAgo(59);
    expect(inviteRefusal({ ...fresh, inviteCount: 1, invitedAt })).toEqual({
      reason: "tooSoon",
      retryAt: new Date(invitedAt.getTime() + RESEND_AFTER_MS),
    });
    expect(
      inviteRefusal({ ...fresh, inviteCount: 1, invitedAt: minutesAgo(61) }),
    ).toBeNull();
  });

  it("stops after a few emails to one address: the link still works", () => {
    expect(
      inviteRefusal({
        ...fresh,
        inviteCount: INVITES_PER_ADDRESS,
        invitedAt: minutesAgo(600),
      }),
    ).toEqual({ reason: "tooMany", count: INVITES_PER_ADDRESS });
  });

  it("holds each admin to a daily number of invitations", () => {
    expect(
      inviteRefusal({ ...fresh, sentToday: INVITES_PER_ADMIN_PER_DAY - 1 }),
    ).toBeNull();
    expect(
      inviteRefusal({ ...fresh, sentToday: INVITES_PER_ADMIN_PER_DAY }),
    ).toEqual({ reason: "dailyCap", count: INVITES_PER_ADMIN_PER_DAY });
  });

  it("counts the day from midnight UTC", () => {
    expect(startOfUtcDay(new Date("2026-11-04T23:59:59-05:00"))).toEqual(
      new Date("2026-11-05T00:00:00Z"),
    );
    expect(startOfUtcDay(now)).toEqual(new Date("2026-11-04T00:00:00Z"));
  });
});
