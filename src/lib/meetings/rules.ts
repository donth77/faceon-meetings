/**
 * The join rules, kept free of I/O so they can be tested on their own, and free of
 * anything Node-only, so the browser can ask them too (the ⋯ menu offers what
 * canModerate allows). The join flow (join.ts) gathers the facts and applies these.
 */
import type { MeetingRole, SessionSnapshot } from "@/lib/media/types";

import type { MeetingErrorCode, ModerateRequest } from "./api";
import type { MeetingSettings } from "./settings";

/**
 * How long a session may sit empty before the next join starts a fresh one. A host who
 * reloads or switches networks gets the same session back within it.
 */
export const SESSION_GRACE_MS = 2 * 60 * 1000;

/**
 * The owner hosts; an in-session promotion to co-host sticks on rejoin; everyone else
 * joins as a participant, or as a guest without an account.
 */
export function resolveRole(input: {
  isOwner: boolean;
  isGuest: boolean;
  memberRole: MeetingRole | undefined;
}): MeetingRole {
  if (input.isOwner) return "host";
  if (input.memberRole === "cohost") return "cohost";
  return input.isGuest ? "guest" : "participant";
}

/** Why a meeting's link no longer works. */
export type ClosedReason = "ended" | "cancelled" | "expired";

/**
 * Why a meeting's link stopped working, or null while it works: an instant meeting
 * ended, a scheduled one was cancelled, or the link outlived its meeting (or series).
 */
export function closedReason(
  meeting: { status: "active" | "ended" | "cancelled"; expiresAt: Date | null },
  now: Date,
): ClosedReason | null {
  if (meeting.status !== "active") return meeting.status;
  return meeting.expiresAt !== null && meeting.expiresAt <= now
    ? "expired"
    : null;
}

/** What the join API answers for a meeting whose link no longer works. */
export const CLOSED_ERRORS = {
  ended: "ENDED",
  cancelled: "CANCELLED",
  expired: "LINK_EXPIRED",
} as const satisfies Record<ClosedReason, MeetingErrorCode>;

export const isHostRole = (role: MeetingRole) =>
  role === "host" || role === "cohost";

/**
 * Case-insensitive passcode check, in constant time: it looks at every character
 * whatever it finds, so how long it takes says nothing about how close a guess was.
 */
export function passcodeMatches(
  expected: string,
  given: string | undefined,
): boolean {
  if (!given) return false;
  const a = expected.toUpperCase();
  const b = given.trim().toUpperCase();
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return difference === 0;
}

/**
 * Whether an open session should be closed instead of joined: its call ended, it sat
 * empty past the grace period, or its call never appeared.
 */
export function isSessionStale(
  startedAt: Date,
  snapshot: SessionSnapshot | null,
  now: Date,
): boolean {
  const pastGrace = (since: Date) =>
    now.getTime() - since.getTime() > SESSION_GRACE_MS;
  if (!snapshot) return pastGrace(startedAt);
  if (snapshot.ended) return true;
  return snapshot.emptySince !== null && pastGrace(snapshot.emptySince);
}

/**
 * When a session that's no longer usable ended. With someone still connected (the call
 * was ended for everyone), now. Otherwise the last time anyone was seen in it, never
 * before it started: a session closed late, by the next join or the daily sweep, keeps
 * the length it really had.
 */
export function sessionEndedAt(
  session: { startedAt: Date; lastSeenAt: Date | null },
  snapshot: SessionSnapshot | null,
  now: Date,
): Date {
  if (snapshot && snapshot.connectedUserIds.length > 0) return now;
  const seen = session.lastSeenAt ?? session.startedAt;
  const end = Math.max(session.startedAt.getTime(), seen.getTime());
  return new Date(Math.min(now.getTime(), end));
}

export type EntryFacts = {
  role: MeetingRole;
  settings: MeetingSettings;
  /** The meeting's passcode, or null when it has none. */
  passcode: string | null;
  givenPasscode: string | undefined;
  /** Already admitted to the open session (a rejoin): no passcode needed again. */
  isMember: boolean;
  isBanned: boolean;
  /** A host locked the session: nobody new gets in. */
  locked: boolean;
  /** Newcomers ask the hosts first (the meeting's setting, or the session's). */
  waitingRoom: boolean;
  /** How often hosts turned this person away in this session's waiting room. */
  timesDenied: number;
  hostPresent: boolean;
  /** Connected now, against the session's limit. */
  connectedCount: number;
  maxParticipants: number;
  /** Already connected (say, on another device), so they don't take another seat. */
  alreadyConnected: boolean;
};

/** Turned away this often, someone can't ask to join that session again. */
export const MAX_DENIALS = 3;

/**
 * Whether someone may be admitted now. Null means yes; "waiting_room" means they ask
 * the hosts first. People already admitted to the session (a refresh, a second device)
 * skip the passcode and the waiting room.
 */
export function checkEntry(
  facts: EntryFacts,
): MeetingErrorCode | "waiting_for_host" | "waiting_room" | null {
  if (facts.isBanned) return "REMOVED";
  if (isHostRole(facts.role)) return null;
  if (facts.locked && !facts.isMember) return "LOCKED";
  if (
    !facts.isMember &&
    facts.passcode !== null &&
    !passcodeMatches(facts.passcode, facts.givenPasscode)
  ) {
    return "BAD_PASSCODE";
  }
  const asks = facts.waitingRoom && !facts.isMember;
  if (asks && facts.timesDenied >= MAX_DENIALS) return "DENIED";
  // Only hosts admit, so with the waiting room on, newcomers wait for one to arrive.
  if (!facts.hostPresent && (!facts.settings.joinBeforeHost || asks)) {
    return "waiting_for_host";
  }
  if (
    !facts.alreadyConnected &&
    facts.connectedCount >= facts.maxParticipants
  ) {
    return "FULL";
  }
  return asks ? "waiting_room" : null;
}

export type ModerationAction = ModerateRequest["action"];

/**
 * Who may do what to whom (the permission matrix). Hosts and co-hosts moderate; only the
 * host makes or unmakes co-hosts; nobody removes the host, and co-hosts don't remove
 * each other. `target` is null for actions on everyone, or clearing a spotlight.
 */
export function canModerate(input: {
  actor: MeetingRole;
  action: ModerationAction;
  target: { role: MeetingRole; isSelf: boolean } | null;
}): boolean {
  const { actor, action, target } = input;
  if (!isHostRole(actor)) return false;
  switch (action) {
    case "muteAll":
    case "setPolicy":
    case "spotlight":
      return true;
    case "mute":
      return target !== null;
    case "askToUnmute":
      return target !== null && !target.isSelf;
    case "remove":
      return (
        target !== null &&
        !target.isSelf &&
        target.role !== "host" &&
        (actor === "host" || target.role !== "cohost")
      );
    case "makeCohost":
      return (
        actor === "host" &&
        (target?.role === "participant" || target?.role === "guest")
      );
    case "removeCohost":
      return actor === "host" && target?.role === "cohost";
  }
}

/**
 * AI notes: hosts and co-hosts turn them on or off for everyone. They go on only where
 * the meeting's host allows them (Settings → AI notes) and it isn't a demo meeting; off
 * always works.
 */
export function canSetNotes(input: {
  actor: MeetingRole;
  on: boolean;
  demo: boolean;
  /** The meeting's host allows AI notes in their meetings. */
  allowed: boolean;
}): boolean {
  if (!isHostRole(input.actor)) return false;
  return !input.on || (input.allowed && !input.demo);
}

/** Saving AI notes to a session: hosts and co-hosts with an account. */
export function canSaveNotes(member: {
  role: MeetingRole;
  userId: string | null;
}): boolean {
  return isHostRole(member.role) && member.userId !== null;
}

/**
 * Who sees saved AI notes: whoever saved them and the meeting's host, and once they're
 * shared, everyone with an account who was in that session.
 */
export function canReadNotes(input: {
  viewer: string;
  savedBy: string;
  hostId: string;
  shared: boolean;
  attended: boolean;
}): boolean {
  return canManageNotes(input) || (input.shared && input.attended);
}

/** Sharing or deleting saved AI notes: whoever saved them, or the meeting's host. */
export function canManageNotes(input: {
  viewer: string;
  savedBy: string;
  hostId: string;
}): boolean {
  return input.viewer === input.savedBy || input.viewer === input.hostId;
}
