import { describe, expect, it } from "vitest";

import type { MeetingRole } from "@/lib/media/types";

import {
  autoSharing,
  canManageNotes,
  canModerate,
  canReadNotes,
  canSaveNotes,
  canSetNotes,
  checkEntry,
  closedReason,
  isSessionLive,
  isSessionStale,
  notesOnJoin,
  notesStartAutomatically,
  offersNotes,
  passcodeMatches,
  passcodeNeeded,
  providerParticipantCap,
  resolveRole,
  seatsLeft,
  SESSION_GRACE_MS,
  sessionEndedAt,
  type EntryFacts,
} from "./rules";
import { DEFAULT_SETTINGS } from "./settings";

describe("resolveRole", () => {
  it("makes the owner the host", () => {
    expect(
      resolveRole({
        isOwner: true,
        isGuest: false,
        memberRole: undefined,
        namedCohost: false,
      }),
    ).toBe("host");
  });

  it("keeps an in-session co-host promotion on rejoin", () => {
    expect(
      resolveRole({
        isOwner: false,
        isGuest: true,
        memberRole: "cohost",
        namedCohost: false,
      }),
    ).toBe("cohost");
  });

  it("makes people without an account guests", () => {
    expect(
      resolveRole({
        isOwner: false,
        isGuest: true,
        memberRole: undefined,
        namedCohost: false,
      }),
    ).toBe("guest");
  });

  it("makes everyone else a participant", () => {
    expect(
      resolveRole({
        isOwner: false,
        isGuest: false,
        memberRole: undefined,
        namedCohost: false,
      }),
    ).toBe("participant");
    expect(
      resolveRole({
        isOwner: false,
        isGuest: false,
        memberRole: "participant",
        namedCohost: false,
      }),
    ).toBe("participant");
  });

  const named = {
    isOwner: false,
    isGuest: false,
    memberRole: undefined,
    namedCohost: true,
  } as const;

  it("makes someone the meeting names a co-host as they join", () => {
    expect(resolveRole(named)).toBe("cohost");
  });

  it("keeps the role hosts gave someone in the session, named or not", () => {
    expect(resolveRole({ ...named, memberRole: "participant" })).toBe(
      "participant",
    );
    expect(resolveRole({ ...named, memberRole: "cohost" })).toBe("cohost");
  });

  it("never names a guest a co-host, and the owner still hosts", () => {
    expect(resolveRole({ ...named, isGuest: true })).toBe("guest");
    expect(resolveRole({ ...named, isOwner: true })).toBe("host");
  });
});

describe("autoSharing", () => {
  const made = { shareNotes: true, canSave: true, saved: false };

  it("shares notes as soon as they're made, in a meeting that shares them", () => {
    expect(autoSharing(made)).toBe("share");
  });

  it("says so where they can't be saved (no account)", () => {
    expect(autoSharing({ ...made, canSave: false })).toBe("cantSave");
  });

  it("does nothing in other meetings, or once they're saved", () => {
    expect(autoSharing({ ...made, shareNotes: false })).toBeNull();
    expect(autoSharing({ ...made, saved: true })).toBeNull();
  });
});

describe("closedReason", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  const later = new Date("2026-11-03T12:00:00Z");
  const earlier = new Date("2026-11-01T12:00:00Z");

  it("leaves an active meeting open until it expires", () => {
    expect(closedReason({ status: "active", expiresAt: null }, now)).toBeNull();
    expect(
      closedReason({ status: "active", expiresAt: later }, now),
    ).toBeNull();
  });

  it("says why a link stopped working", () => {
    expect(closedReason({ status: "ended", expiresAt: later }, now)).toBe(
      "ended",
    );
    expect(closedReason({ status: "cancelled", expiresAt: null }, now)).toBe(
      "cancelled",
    );
    expect(closedReason({ status: "active", expiresAt: earlier }, now)).toBe(
      "expired",
    );
    expect(closedReason({ status: "active", expiresAt: now }, now)).toBe(
      "expired",
    );
  });

  it("puts ending and cancelling before expiry", () => {
    expect(closedReason({ status: "cancelled", expiresAt: earlier }, now)).toBe(
      "cancelled",
    );
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

describe("isSessionLive", () => {
  const now = new Date("2026-11-04T15:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const session = { startedAt: ago(10), limits: { maxParticipants: 100 } };
  const inCall = { ended: false, connectedUserIds: ["u_1"], emptySince: null };

  it("is live while someone is in the call", () => {
    expect(isSessionLive(session, inCall, now)).toBe(true);
    expect(
      isSessionLive(
        session,
        { ...inCall, connectedUserIds: ["u_1", "g_2"] },
        now,
      ),
    ).toBe(true);
  });

  it("isn't live while nobody's in it: not joined yet, or everyone just left", () => {
    expect(isSessionLive(session, null, now)).toBe(false);
    expect(
      isSessionLive(
        session,
        { ended: false, connectedUserIds: [], emptySince: ago(1) },
        now,
      ),
    ).toBe(false);
  });

  it("isn't live once the call ended for everyone", () => {
    expect(isSessionLive(session, { ...inCall, ended: true }, now)).toBe(false);
  });

  it("isn't live past a demo session's time limit, even before the call ends", () => {
    const demo = {
      startedAt: ago(15),
      limits: { maxParticipants: 4, maxDurationSeconds: 900, demo: true },
    };
    expect(isSessionLive(demo, inCall, now)).toBe(false);
    expect(isSessionLive({ ...demo, startedAt: ago(14) }, inCall, now)).toBe(
      true,
    );
  });
});

describe("sessionEndedAt", () => {
  const now = new Date("2026-11-02T15:49:31Z");
  const startedAt = new Date("2026-11-02T10:25:06Z");
  const empty = {
    ended: false,
    connectedUserIds: [],
    emptySince: new Date("2026-11-02T10:25:49Z"),
  };

  it("ends a session closed late when someone was last there, not when it was noticed", () => {
    const lastSeenAt = new Date("2026-11-02T10:26:33Z");
    expect(sessionEndedAt({ startedAt, lastSeenAt }, empty, now)).toEqual(
      lastSeenAt,
    );
  });

  it("ends a session nobody was seen in as it started", () => {
    expect(sessionEndedAt({ startedAt, lastSeenAt: null }, empty, now)).toEqual(
      startedAt,
    );
    expect(sessionEndedAt({ startedAt, lastSeenAt: null }, null, now)).toEqual(
      startedAt,
    );
  });

  it("ends now while someone is still connected (ended for everyone)", () => {
    const ended = { ended: true, connectedUserIds: ["u_1"], emptySince: null };
    expect(
      sessionEndedAt(
        { startedAt, lastSeenAt: new Date("2026-11-02T11:00:00Z") },
        ended,
        now,
      ),
    ).toEqual(now);
  });

  it("stays between the start and now, whatever the clocks say", () => {
    expect(
      sessionEndedAt(
        { startedAt, lastSeenAt: new Date("2026-11-02T10:00:00Z") },
        empty,
        now,
      ),
    ).toEqual(startedAt);
    expect(
      sessionEndedAt(
        { startedAt, lastSeenAt: new Date("2026-11-02T16:00:00Z") },
        empty,
        now,
      ),
    ).toEqual(now);
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

  it("needs the passcode from the people joining asks it of, and only them", () => {
    // The join screen asks up front from these same facts.
    expect(passcodeNeeded(facts)).toBe("K7XQ2M");
    expect(passcodeNeeded({ ...facts, role: "guest" })).toBe("K7XQ2M");
    expect(passcodeNeeded({ ...facts, role: "host" })).toBeNull();
    expect(passcodeNeeded({ ...facts, role: "cohost" })).toBeNull();
    expect(passcodeNeeded({ ...facts, isMember: true })).toBeNull();
    expect(passcodeNeeded({ ...facts, passcode: null })).toBeNull();
    // Whenever it says none is needed, joining without one works.
    for (const role of ["host", "cohost"] as const) {
      expect(
        checkEntry({ ...facts, role, givenPasscode: undefined }),
      ).toBeNull();
    }
    expect(
      checkEntry({ ...facts, passcode: null, givenPasscode: undefined }),
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

  it("turns people away from a full meeting, but not someone already in it", () => {
    const full = { ...facts, connectedCount: 20 };
    expect(checkEntry(full)).toBe("FULL");
    expect(checkEntry({ ...full, alreadyConnected: true })).toBeNull();
    expect(checkEntry({ ...full, isMember: true })).toBe("FULL");
    expect(checkEntry({ ...facts, connectedCount: 19 })).toBeNull();
  });

  it("always lets the meeting's host in, even when it's full", () => {
    expect(
      checkEntry({
        ...facts,
        role: "host",
        connectedCount: 20,
        givenPasscode: undefined,
      }),
    ).toBeNull();
  });

  it("gives co-hosts a seat like anyone else, but no passcode or waiting room", () => {
    const cohost = {
      ...facts,
      role: "cohost" as const,
      givenPasscode: undefined,
    };
    expect(checkEntry({ ...cohost, waitingRoom: true })).toBeNull();
    expect(checkEntry({ ...cohost, connectedCount: 20 })).toBe("FULL");
    expect(
      checkEntry({ ...cohost, connectedCount: 20, alreadyConnected: true }),
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

describe("AI notes that start automatically", () => {
  const meeting = {
    autoNotes: true,
    allowed: true,
    demo: false,
    stopped: false,
  };
  const joining = { ...meeting, runsNotes: true, on: false, canMake: true };

  it("start for a meeting set to start them, where its host allows AI notes", () => {
    expect(notesStartAutomatically(meeting)).toBe(true);
    expect(notesStartAutomatically({ ...meeting, autoNotes: false })).toBe(
      false,
    );
    expect(notesStartAutomatically({ ...meeting, allowed: false })).toBe(false);
  });

  it("never start in demo meetings", () => {
    expect(notesStartAutomatically({ ...meeting, demo: true })).toBe(false);
  });

  it("stay off once someone stopped them in the session", () => {
    expect(notesStartAutomatically({ ...meeting, stopped: true })).toBe(false);
    expect(notesOnJoin({ ...joining, stopped: true })).toBeNull();
  });

  it("are started by a host or co-host joining, if their browser can make notes", () => {
    expect(notesOnJoin(joining)).toBe("start");
    expect(notesOnJoin({ ...joining, runsNotes: false })).toBeNull();
  });

  it("tell a host whose browser can't make notes why they didn't start", () => {
    expect(notesOnJoin({ ...joining, canMake: false })).toBe("cantMake");
  });

  it("change nothing when notes are already on", () => {
    expect(notesOnJoin({ ...joining, on: true })).toBeNull();
    expect(notesOnJoin({ ...joining, on: true, canMake: false })).toBeNull();
  });

  it("don't concern meetings that start them by hand", () => {
    expect(notesOnJoin({ ...joining, autoNotes: false })).toBeNull();
    expect(
      notesOnJoin({ ...joining, autoNotes: false, canMake: false }),
    ).toBeNull();
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

describe("seatsLeft", () => {
  it("leaves the cap less everyone connected and arriving", () => {
    expect(seatsLeft({ maxParticipants: 4, connected: 2, arriving: 1 })).toBe(
      1,
    );
    expect(seatsLeft({ maxParticipants: 4, connected: 4, arriving: 0 })).toBe(
      0,
    );
  });

  it("never goes below zero, when the host came in over the cap", () => {
    expect(seatsLeft({ maxParticipants: 4, connected: 5, arriving: 1 })).toBe(
      0,
    );
  });
});

describe("providerParticipantCap", () => {
  it("leaves the provider room for the host and a second device", () => {
    expect(providerParticipantCap(4)).toBe(6);
    expect(providerParticipantCap(20)).toBe(22);
  });
});

describe("offersNotes", () => {
  const offered = {
    runsNotes: true,
    allowed: true,
    demo: false,
    on: false,
    transcribed: false,
  };

  it("offers AI notes to hosts and co-hosts where the meeting has them", () => {
    expect(offersNotes(offered)).toBe(true);
    expect(offersNotes({ ...offered, runsNotes: false })).toBe(false);
  });

  it("leaves them out where the host turned them off, and in demo meetings", () => {
    expect(offersNotes({ ...offered, allowed: false })).toBe(false);
    expect(offersNotes({ ...offered, demo: true })).toBe(false);
  });

  it("keeps notes that are on, or a transcript still to become notes, within reach", () => {
    expect(offersNotes({ ...offered, allowed: false, on: true })).toBe(true);
    expect(offersNotes({ ...offered, allowed: false, transcribed: true })).toBe(
      true,
    );
    expect(
      offersNotes({ ...offered, runsNotes: false, transcribed: true }),
    ).toBe(false);
  });
});
