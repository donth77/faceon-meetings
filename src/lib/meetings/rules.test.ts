import { describe, expect, it } from "vitest";

import type { MeetingRole } from "@/lib/media/types";

import {
  canManageNotes,
  canModerate,
  canReadNotes,
  canSaveNotes,
  canSetNotes,
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

  it("rejects a longer guess that starts with the passcode", () => {
    expect(passcodeMatches("K7XQ2M", "K7XQ2MA")).toBe(false);
    expect(passcodeMatches("K7XQ2M", "")).toBe(false);
  });

  it("runs without Node's crypto, so the browser can use these rules", () => {
    // Characters beyond ASCII compare too, and a near miss is still a miss.
    expect(passcodeMatches("ÆBC123", "æbc123")).toBe(true);
    expect(passcodeMatches("ÆBC123", "æbc124")).toBe(false);
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
    locked: false,
    waitingRoom: false,
    timesDenied: 0,
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

  it("keeps newcomers out of a locked meeting, but lets members and hosts back in", () => {
    const locked = { ...facts, locked: true };
    expect(checkEntry(locked)).toBe("LOCKED");
    expect(checkEntry({ ...locked, isMember: true })).toBeNull();
    expect(
      checkEntry({ ...locked, role: "host", givenPasscode: undefined }),
    ).toBeNull();
  });

  it("sends newcomers to the waiting room when it's on, but not members or hosts", () => {
    expect(checkEntry({ ...facts, waitingRoom: true })).toBe("waiting_room");
    expect(
      checkEntry({ ...facts, waitingRoom: true, isMember: true }),
    ).toBeNull();
    expect(
      checkEntry({ ...facts, waitingRoom: true, role: "host" }),
    ).toBeNull();
    expect(
      checkEntry({ ...facts, waitingRoom: true, role: "cohost" }),
    ).toBeNull();
  });

  it("asks the passcode before the waiting room", () => {
    expect(
      checkEntry({ ...facts, waitingRoom: true, givenPasscode: "WRONG1" }),
    ).toBe("BAD_PASSCODE");
  });

  it("makes newcomers wait for a host when only hosts can let them in", () => {
    expect(
      checkEntry({ ...facts, waitingRoom: true, hostPresent: false }),
    ).toBe("waiting_for_host");
    expect(
      checkEntry({
        ...facts,
        waitingRoom: true,
        hostPresent: false,
        isMember: true,
      }),
    ).toBeNull();
  });

  it("stops someone asking after being turned away three times", () => {
    expect(checkEntry({ ...facts, waitingRoom: true, timesDenied: 2 })).toBe(
      "waiting_room",
    );
    expect(checkEntry({ ...facts, waitingRoom: true, timesDenied: 3 })).toBe(
      "DENIED",
    );
  });

  it("turns people away from a full meeting unless they're already in it", () => {
    const full = { ...facts, connectedCount: 20 };
    expect(checkEntry(full)).toBe("FULL");
    expect(checkEntry({ ...full, alreadyConnected: true })).toBeNull();
  });
});

describe("canModerate", () => {
  const someone = (role: MeetingRole, isSelf = false) => ({ role, isSelf });

  it("lets only hosts and co-hosts moderate", () => {
    for (const actor of ["participant", "guest"] as const) {
      expect(canModerate({ actor, action: "muteAll", target: null })).toBe(
        false,
      );
      expect(
        canModerate({ actor, action: "mute", target: someone("guest") }),
      ).toBe(false);
      expect(canModerate({ actor, action: "setPolicy", target: null })).toBe(
        false,
      );
    }
    for (const actor of ["host", "cohost"] as const) {
      expect(canModerate({ actor, action: "muteAll", target: null })).toBe(
        true,
      );
      expect(canModerate({ actor, action: "setPolicy", target: null })).toBe(
        true,
      );
      expect(canModerate({ actor, action: "spotlight", target: null })).toBe(
        true,
      );
      expect(
        canModerate({ actor, action: "mute", target: someone("host") }),
      ).toBe(true);
    }
  });

  it("asks others to unmute, not yourself", () => {
    expect(
      canModerate({
        actor: "cohost",
        action: "askToUnmute",
        target: someone("guest"),
      }),
    ).toBe(true);
    expect(
      canModerate({
        actor: "host",
        action: "askToUnmute",
        target: someone("host", true),
      }),
    ).toBe(false);
  });

  it("never removes the host or yourself; co-hosts don't remove co-hosts", () => {
    const remove = (
      actor: MeetingRole,
      target: { role: MeetingRole; isSelf: boolean },
    ) => canModerate({ actor, action: "remove", target });
    expect(remove("host", someone("guest"))).toBe(true);
    expect(remove("host", someone("cohost"))).toBe(true);
    expect(remove("cohost", someone("participant"))).toBe(true);
    expect(remove("cohost", someone("cohost"))).toBe(false);
    expect(remove("cohost", someone("host"))).toBe(false);
    expect(remove("host", someone("host", true))).toBe(false);
  });

  it("lets only the host make and unmake co-hosts", () => {
    expect(
      canModerate({
        actor: "host",
        action: "makeCohost",
        target: someone("guest"),
      }),
    ).toBe(true);
    expect(
      canModerate({
        actor: "cohost",
        action: "makeCohost",
        target: someone("participant"),
      }),
    ).toBe(false);
    expect(
      canModerate({
        actor: "host",
        action: "makeCohost",
        target: someone("cohost"),
      }),
    ).toBe(false);
    expect(
      canModerate({
        actor: "host",
        action: "removeCohost",
        target: someone("cohost"),
      }),
    ).toBe(true);
    expect(
      canModerate({
        actor: "host",
        action: "removeCohost",
        target: someone("participant"),
      }),
    ).toBe(false);
  });

  it("needs someone to act on", () => {
    expect(canModerate({ actor: "host", action: "mute", target: null })).toBe(
      false,
    );
    expect(canModerate({ actor: "host", action: "remove", target: null })).toBe(
      false,
    );
  });
});

describe("canSetNotes", () => {
  const meeting = { demo: false, allowed: true };

  it("lets hosts and co-hosts turn AI notes on and off", () => {
    for (const actor of ["host", "cohost"] as const) {
      expect(canSetNotes({ ...meeting, actor, on: true })).toBe(true);
      expect(canSetNotes({ ...meeting, actor, on: false })).toBe(true);
    }
  });

  it("doesn't let participants or guests", () => {
    for (const actor of ["participant", "guest"] as const) {
      expect(canSetNotes({ ...meeting, actor, on: true })).toBe(false);
      expect(canSetNotes({ ...meeting, actor, on: false })).toBe(false);
    }
  });

  it("keeps them off in demo meetings", () => {
    const demo = { ...meeting, demo: true };
    expect(canSetNotes({ ...demo, actor: "host", on: true })).toBe(false);
    expect(canSetNotes({ ...demo, actor: "host", on: false })).toBe(true);
  });

  it("starts them only where the meeting's host allows AI notes", () => {
    const notAllowed = { ...meeting, allowed: false };
    for (const actor of ["host", "cohost"] as const) {
      expect(canSetNotes({ ...notAllowed, actor, on: true })).toBe(false);
      // Turning them off always works, say just after the host stopped allowing them.
      expect(canSetNotes({ ...notAllowed, actor, on: false })).toBe(true);
    }
  });
});

describe("saved AI notes", () => {
  it("are saved by hosts and co-hosts with an account", () => {
    expect(canSaveNotes({ role: "host", userId: "u1" })).toBe(true);
    expect(canSaveNotes({ role: "cohost", userId: "u2" })).toBe(true);
    expect(canSaveNotes({ role: "cohost", userId: null })).toBe(false);
    expect(canSaveNotes({ role: "participant", userId: "u3" })).toBe(false);
  });

  const notes = { savedBy: "saver", hostId: "host", shared: false };

  it("are seen by whoever saved them and the host", () => {
    expect(canReadNotes({ ...notes, viewer: "saver", attended: true })).toBe(
      true,
    );
    expect(canReadNotes({ ...notes, viewer: "host", attended: false })).toBe(
      true,
    );
    expect(canReadNotes({ ...notes, viewer: "guest", attended: true })).toBe(
      false,
    );
  });

  it("are seen by attendees once shared, and nobody else", () => {
    const shared = { ...notes, shared: true };
    expect(canReadNotes({ ...shared, viewer: "ana", attended: true })).toBe(
      true,
    );
    expect(canReadNotes({ ...shared, viewer: "eve", attended: false })).toBe(
      false,
    );
  });

  it("are shared or deleted only by whoever saved them, or the host", () => {
    expect(canManageNotes({ ...notes, viewer: "saver" })).toBe(true);
    expect(canManageNotes({ ...notes, viewer: "host" })).toBe(true);
    expect(canManageNotes({ ...notes, viewer: "ana" })).toBe(false);
  });
});
