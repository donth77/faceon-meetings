import { describe, expect, it } from "vitest";

import {
  checkEntry,
  isSessionStale,
  passcodeMatches,
  resolveRole,
  SESSION_GRACE_MS,
  type EntryFacts,
} from "./rules";
import { DEFAULT_SETTINGS } from "./settings";

describe("resolveRole", () => {
  it("makes the owner the host", () => {
    expect(
      resolveRole({ isOwner: true, isGuest: false, memberRole: undefined }),
    ).toBe("host");
  });

  it("keeps an in-session co-host promotion on rejoin", () => {
    expect(
      resolveRole({ isOwner: false, isGuest: true, memberRole: "cohost" }),
    ).toBe("cohost");
  });

  it("makes people without an account guests", () => {
    expect(
      resolveRole({ isOwner: false, isGuest: true, memberRole: undefined }),
    ).toBe("guest");
  });

  it("makes everyone else a participant", () => {
    expect(
      resolveRole({ isOwner: false, isGuest: false, memberRole: undefined }),
    ).toBe("participant");
    expect(
      resolveRole({
        isOwner: false,
        isGuest: false,
        memberRole: "participant",
      }),
    ).toBe("participant");
  });
});

describe("passcodeMatches", () => {
  it("ignores case and surrounding spaces", () => {
    expect(passcodeMatches("K7XQ2M", " k7xq2m ")).toBe(true);
  });

  it("rejects wrong, short and missing passcodes", () => {
    expect(passcodeMatches("K7XQ2M", "K7XQ2N")).toBe(false);
    expect(passcodeMatches("K7XQ2M", "K7XQ2")).toBe(false);
    expect(passcodeMatches("K7XQ2M", undefined)).toBe(false);
  });
});

describe("isSessionStale", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const live = { ended: false, connectedUserIds: ["u_1"], emptySince: null };

  it("keeps a session with people in it", () => {
    expect(isSessionStale(ago(3_600_000), live, now)).toBe(false);
  });

  it("closes a session whose call ended", () => {
    expect(isSessionStale(ago(1000), { ...live, ended: true }, now)).toBe(true);
  });

  it("keeps an empty session through the grace period, then closes it", () => {
    const empty = (ms: number) => ({
      ended: false,
      connectedUserIds: [],
      emptySince: ago(ms),
    });
    expect(isSessionStale(ago(3_600_000), empty(1000), now)).toBe(false);
    expect(
      isSessionStale(ago(3_600_000), empty(SESSION_GRACE_MS + 1), now),
    ).toBe(true);
  });

  it("waits for a call that's still being created", () => {
    expect(isSessionStale(ago(1000), null, now)).toBe(false);
    expect(isSessionStale(ago(SESSION_GRACE_MS + 1), null, now)).toBe(true);
  });
});

describe("checkEntry", () => {
  const facts: EntryFacts = {
    role: "participant",
    settings: DEFAULT_SETTINGS.instant,
    passcode: "K7XQ2M",
    givenPasscode: "K7XQ2M",
    isMember: false,
    isBanned: false,
    hostPresent: true,
    connectedCount: 1,
    maxParticipants: 20,
    alreadyConnected: false,
  };

  it("admits someone with the right passcode", () => {
    expect(checkEntry(facts)).toBeNull();
  });

  it("asks for the passcode, except on a rejoin", () => {
    expect(checkEntry({ ...facts, givenPasscode: "WRONG1" })).toBe(
      "BAD_PASSCODE",
    );
    expect(
      checkEntry({ ...facts, givenPasscode: undefined, isMember: true }),
    ).toBeNull();
  });

  it("lets hosts in without a passcode", () => {
    expect(
      checkEntry({ ...facts, role: "host", givenPasscode: undefined }),
    ).toBeNull();
  });

  it("keeps removed people out, co-hosts included", () => {
    expect(checkEntry({ ...facts, isBanned: true })).toBe("REMOVED");
    expect(checkEntry({ ...facts, role: "cohost", isBanned: true })).toBe(
      "REMOVED",
    );
  });

  it("waits for the host when join-before-host is off", () => {
    const settings = DEFAULT_SETTINGS.scheduled;
    expect(checkEntry({ ...facts, settings, hostPresent: false })).toBe(
      "waiting_for_host",
    );
    expect(checkEntry({ ...facts, settings, hostPresent: true })).toBeNull();
  });

  it("turns people away from a full meeting unless they're already in it", () => {
    const full = { ...facts, connectedCount: 20 };
    expect(checkEntry(full)).toBe("FULL");
    expect(checkEntry({ ...full, alreadyConnected: true })).toBeNull();
  });
});
