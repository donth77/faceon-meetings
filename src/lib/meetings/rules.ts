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
 * The owner hosts. Someone already in the session keeps the role hosts gave them there
 * (made a co-host, or no longer one), also on rejoin. Anyone else the meeting names as a
 * co-host (by a verified address, so never a guest) joins as one. Everyone else joins as
 * a participant, or as a guest without an account.
 */
export function resolveRole(input: {
  isOwner: boolean;
  isGuest: boolean;
  memberRole: MeetingRole | undefined;
  /** Signed in with a verified address the meeting names as a co-host. */
  namedCohost: boolean;
}): MeetingRole {
  if (input.isOwner) return "host";
  if (input.memberRole === "cohost") return "cohost";
  if (input.memberRole === undefined && input.namedCohost && !input.isGuest) {
    return "cohost";
  }
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

/**
 * The passcode someone must give to join: the meeting's, unless they're one of its hosts
 * or already admitted to the session running now. The meeting page asks for it up front
 * from the same facts, without ever sending it to the browser.
 */
export function passcodeNeeded(
  facts: Pick<EntryFacts, "role" | "passcode" | "isMember">,
): string | null {
  return isHostRole(facts.role) || facts.isMember ? null : facts.passcode;
}

/** Turned away this often, someone can't ask to join that session again. */
export const MAX_DENIALS = 3;

/**
 * Whether someone may be admitted now. Null means yes; "waiting_room" means they ask
 * the hosts first. People already admitted to the session (a refresh, a second device)
 * skip the passcode and the waiting room. The meeting's own host is never turned away,
 * even from a full meeting; co-hosts skip everything but the cap, since they take a
 * seat like anyone else.
 */
export function checkEntry(
  facts: EntryFacts,
): MeetingErrorCode | "waiting_for_host" | "waiting_room" | null {
  if (facts.isBanned) return "REMOVED";
  if (facts.role === "host") return null;
  if (isHostRole(facts.role)) return isFull(facts) ? "FULL" : null;
  if (facts.locked && !facts.isMember) return "LOCKED";
  const passcode = passcodeNeeded(facts);
  if (passcode !== null && !passcodeMatches(passcode, facts.givenPasscode)) {
    return "BAD_PASSCODE";
  }
  const asks = facts.waitingRoom && !facts.isMember;
  if (asks && facts.timesDenied >= MAX_DENIALS) return "DENIED";
  // Only hosts admit, so with the waiting room on, newcomers wait for one to arrive.
  if (!facts.hostPresent && (!facts.settings.joinBeforeHost || asks)) {
    return "waiting_for_host";
  }
  if (isFull(facts)) return "FULL";
  return asks ? "waiting_room" : null;
}

/** No seat for this person: the meeting is at its cap, and they aren't in it already. */
function isFull(
  facts: Pick<
    EntryFacts,
    "alreadyConnected" | "connectedCount" | "maxParticipants"
  >,
): boolean {
  return (
    !facts.alreadyConnected && facts.connectedCount >= facts.maxParticipants
  );
}

/**
 * Seats left for people let in from the waiting room: the cap, less everyone connected
 * and everyone let in moments ago who hasn't connected yet (`arriving`).
 */
export function seatsLeft(input: {
  maxParticipants: number;
  connected: number;
  arriving: number;
}): number {
  return Math.max(0, input.maxParticipants - input.connected - input.arriving);
}

/**
 * Let in this long ago and not connected yet, someone still holds their seat; after
 * that, a host may give it to someone else (they wait again if it's taken).
 */
export const ARRIVING_MS = 60_000;

/**
 * The cap the media provider enforces, behind ours: room above it for the meeting's
 * host, who is never turned away, and for someone joining on a second device, so the
 * provider refuses only joins that slipped past our check at the same moment.
 */
export function providerParticipantCap(maxParticipants: number): number {
  return maxParticipants + 2;
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

/**
 * Whether AI notes start by themselves in a meeting: it's set to start them, its host
 * allows AI notes, it isn't a demo, and nobody stopped them in this session. Pre-join
 * tells people in advance.
 */
export function notesStartAutomatically(input: {
  /** The meeting's "Start AI notes automatically". */
  autoNotes: boolean;
  /** The meeting's host allows AI notes in their meetings. */
  allowed: boolean;
  demo: boolean;
  /** Someone stopped AI notes earlier in this session. */
  stopped: boolean;
}): boolean {
  return input.autoNotes && input.allowed && !input.demo && !input.stopped;
}

/**
 * What a host's or co-host's browser does about AI notes as they join a meeting: start
 * them where they start automatically, or say why it can't (this browser can't make
 * notes: Chrome's built-in model isn't available and there's no AI key). Nothing when
 * notes are already on, or don't start by themselves, or for everyone else.
 */
export function notesOnJoin(
  input: Parameters<typeof notesStartAutomatically>[0] & {
    /** A host or co-host, where this copy offers AI notes. */
    runsNotes: boolean;
    /** AI notes are already on. */
    on: boolean;
    /** This browser can make notes (Settings → AI notes). */
    canMake: boolean;
  },
): "start" | "cantMake" | null {
  if (!input.runsNotes || input.on || !notesStartAutomatically(input)) {
    return null;
  }
  return input.canMake ? "start" : "cantMake";
}

/**
 * Whether the meeting room offers you AI notes (More → AI notes): you run them, and this
 * meeting has them (not a demo, and its host allows them), or there's something to come
 * back to: notes that are on, or this tab's transcript still to become notes. Where AI
 * notes are off, the room doesn't mention them.
 */
export function offersNotes(input: {
  /** A host or co-host, where this copy offers AI notes. */
  runsNotes: boolean;
  /** The meeting's host allows AI notes in their meetings (Settings → AI notes). */
  allowed: boolean;
  demo: boolean;
  /** AI notes are on. */
  on: boolean;
  /** This tab has a transcript that hasn't become notes yet. */
  transcribed: boolean;
}): boolean {
  if (!input.runsNotes) return false;
  return (input.allowed && !input.demo) || input.on || input.transcribed;
}

/**
 * Notes just made, in a meeting that shares AI notes automatically: saved and shared at
 * once where whoever made them can save them (an account), or a word that they can't be
 * (a guest co-host has no account). Nothing in other meetings, or once they're saved.
 */
export function autoSharing(input: {
  shareNotes: boolean;
  canSave: boolean;
  saved: boolean;
}): "share" | "cantSave" | null {
  if (!input.shareNotes || input.saved) return null;
  return input.canSave ? "share" : "cantSave";
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
