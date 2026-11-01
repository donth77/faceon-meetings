/**
 * The join rules, kept free of I/O so they can be tested on their own. The join flow
 * (join.ts) gathers the facts and applies these.
 */
import { timingSafeEqual } from "node:crypto";

import type { MeetingRole, SessionSnapshot } from "@/lib/media/types";

import type { MeetingErrorCode } from "./api";
import type { MeetingSettings } from "./settings";

/**
 * How long a session may sit empty before the next join starts a fresh one. A host who
 * reloads or switches networks gets the same session back within it.
 */
export const SESSION_GRACE_MS = 2 * 60 * 1000;

/** The owner hosts; an in-session promotion to co-host sticks on rejoin; everyone else participates. */
export function resolveRole(input: {
  isOwner: boolean;
  memberRole: MeetingRole | undefined;
}): MeetingRole {
  if (input.isOwner) return "host";
  if (input.memberRole === "cohost") return "cohost";
  return "participant";
}

/** Whether a meeting's link still works: not ended, cancelled or expired. */
export function isJoinable(
  meeting: { status: string; expiresAt: Date | null },
  now: Date,
): boolean {
  return (
    meeting.status === "active" &&
    (meeting.expiresAt === null || meeting.expiresAt > now)
  );
}

export const isHostRole = (role: MeetingRole) =>
  role === "host" || role === "cohost";

/** Case-insensitive, constant-time passcode check. */
export function passcodeMatches(
  expected: string,
  given: string | undefined,
): boolean {
  if (!given) return false;
  const a = Buffer.from(expected.toUpperCase());
  const b = Buffer.from(given.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
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

export type EntryFacts = {
  role: MeetingRole;
  settings: MeetingSettings;
  /** The meeting's passcode, or null when it has none. */
  passcode: string | null;
  givenPasscode: string | undefined;
  /** Already admitted to the open session (a rejoin): no passcode needed again. */
  isMember: boolean;
  isBanned: boolean;
  hostPresent: boolean;
  /** Connected now, against the session's limit. */
  connectedCount: number;
  maxParticipants: number;
  /** Already connected (say, on another device), so they don't take another seat. */
  alreadyConnected: boolean;
};

/** Whether someone may be admitted now. Null means yes. */
export function checkEntry(
  facts: EntryFacts,
): MeetingErrorCode | "waiting_for_host" | null {
  if (facts.isBanned) return "REMOVED";
  if (isHostRole(facts.role)) return null;
  if (
    !facts.isMember &&
    facts.passcode !== null &&
    !passcodeMatches(facts.passcode, facts.givenPasscode)
  ) {
    return "BAD_PASSCODE";
  }
  if (!facts.hostPresent && !facts.settings.joinBeforeHost) {
    return "waiting_for_host";
  }
  if (
    !facts.alreadyConnected &&
    facts.connectedCount >= facts.maxParticipants
  ) {
    return "FULL";
  }
  return null;
}
