import { afterEach, describe, expect, it, vi } from "vitest";

import { approvedBySettings, hostingPlan, isAdmin, limitsFor } from "./hosting";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hostingPlan", () => {
  it("gives allowlisted and admin accounts full meetings", () => {
    vi.stubEnv("HOST_ALLOWLIST", "Host@Example.com, other@example.com");
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(
      hostingPlan({ email: "host@example.com", emailVerified: true }),
    ).toBe("full");
    expect(
      hostingPlan({ email: "ADMIN@example.com", emailVerified: true }),
    ).toBe("full");
  });

  it("gives everyone else demos", () => {
    vi.stubEnv("HOST_ALLOWLIST", "host@example.com");
    expect(
      hostingPlan({ email: "someone@example.com", emailVerified: true }),
    ).toBe("demo");
  });

  it("counts an allowlisted email only once it's verified", () => {
    vi.stubEnv("HOST_ALLOWLIST", "host@example.com");
    expect(
      hostingPlan({ email: "host@example.com", emailVerified: false }),
    ).toBe("demo");
  });

  it("gives an address an admin approved full meetings, and demos once removed", () => {
    vi.stubEnv("HOST_ALLOWLIST", "");
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    const maya = { email: "maya@example.com", emailVerified: true };
    expect(hostingPlan(maya, true)).toBe("full");
    // Moved back to demo on /admin: the next meeting is a demo.
    expect(hostingPlan(maya, false)).toBe("demo");
    expect(hostingPlan({ ...maya, emailVerified: false }, true)).toBe("demo");
  });
});

describe("approvedBySettings", () => {
  it("covers ADMIN_EMAILS and HOST_ALLOWLIST, in any case", () => {
    vi.stubEnv("HOST_ALLOWLIST", "host@example.com");
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    expect(approvedBySettings("Host@Example.com")).toBe(true);
    expect(approvedBySettings("admin@example.com")).toBe(true);
    expect(approvedBySettings("maya@example.com")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("is only ADMIN_EMAILS, with a verified address", () => {
    vi.stubEnv("ADMIN_EMAILS", "Admin@Example.com");
    vi.stubEnv("HOST_ALLOWLIST", "host@example.com");
    expect(isAdmin({ email: "admin@example.com", emailVerified: true })).toBe(
      true,
    );
    expect(isAdmin({ email: "admin@example.com", emailVerified: false })).toBe(
      false,
    );
    // Approved hosts host full meetings but aren't admins.
    expect(isAdmin({ email: "host@example.com", emailVerified: true })).toBe(
      false,
    );
  });
});

describe("limitsFor", () => {
  it("limits demos in time and size", () => {
    vi.stubEnv("DEMO_MAX_MINUTES", "15");
    vi.stubEnv("DEMO_MAX_PARTICIPANTS", "4");
    expect(limitsFor("demo")).toEqual({
      maxParticipants: 4,
      maxDurationSeconds: 900,
      demo: true,
    });
  });

  it("gives full meetings no time limit unless one is set", () => {
    vi.stubEnv("MAX_PARTICIPANTS_PER_MEETING", "20");
    vi.stubEnv("MAX_MEETING_MINUTES", "0");
    expect(limitsFor("full")).toEqual({ maxParticipants: 20 });
    vi.stubEnv("MAX_MEETING_MINUTES", "90");
    expect(limitsFor("full")).toEqual({
      maxParticipants: 20,
      maxDurationSeconds: 5400,
    });
  });
});
