import "server-only";

import { avatarUrl } from "@/lib/avatars/seed";
import { guestsEnabled } from "@/lib/guest-session";
import { loggable } from "@/lib/log";
import { mediaProvider } from "@/lib/media";

import { requireMeeting, requireMember, requirePrincipal } from "./access";
import { admit } from "./admission";
import type { JoinResponse } from "./api";
import { MeetingError } from "./errors";
import { policyFromSettings } from "./policy";
import { userMediaId, type Principal } from "./principal";
import {
  closeSession,
  endMeeting,
  findMember,
  findOpenSession,
  hostMemberIds,
  isNamedCohost,
  markSessionSeen,
  type MeetingHost,
} from "./queries";
import {
  checkEntry,
  CLOSED_ERRORS,
  closedReason,
  providerParticipantCap,
  resolveRole,
} from "./rules";
import { changeSession, sessionPolicy, sessionState } from "./session-state";
import { currentSession, startSession } from "./sessions";
import { askToJoin, timesDenied } from "./waiting-room";

const hostMediaUser = (host: MeetingHost) => ({
  id: userMediaId(host.id),
  name: host.name,
  image: avatarUrl(host),
});

/**
 * Decides whether someone may join a meeting now and, if so, admits them: opens a session
 * (and its call) when none is open, records the admission and returns a media token.
 * With the waiting room on, newcomers ask the hosts first. Throws MeetingError when they
 * can't join.
 */
export async function joinMeeting(input: {
  code: string;
  name: string;
  passcode: string | undefined;
  principal: Principal | null;
  /** False when this caller has asked to join too often lately (RATE_LIMITED). */
  canAskHosts?: boolean;
}): Promise<JoinResponse> {
  const now = new Date();
  const { meeting, host } = await requireMeeting(input.code);
  const closed = closedReason(meeting, now);
  if (closed) throw new MeetingError(CLOSED_ERRORS[closed]);
  const principal = requirePrincipal(input.principal);
  const isOwner =
    principal.kind === "user" && principal.userId === meeting.hostId;
  if (
    principal.kind === "guest" &&
    !(guestsEnabled() && meeting.settings.allowGuests)
  ) {
    throw new MeetingError("SIGN_IN_REQUIRED");
  }

  const live = await currentSession(meeting, now);
  if (live === "meeting-ended") throw new MeetingError("ENDED");

  const [member, hostIds] = live
    ? await Promise.all([
        findMember(live.row.id, principal.mediaUserId),
        hostMemberIds(live.row.id),
      ])
    : [null, []];
  const role = resolveRole({
    isOwner,
    isGuest: principal.kind === "guest",
    memberRole: member?.role,
    // Only asked of someone new to the session; the role they have there stands.
    namedCohost:
      !isOwner &&
      !member &&
      principal.kind === "user" &&
      principal.verifiedEmail !== null &&
      (await isNamedCohost(meeting.id, principal.verifiedEmail)),
  });
  const connected = live?.snapshot?.connectedUserIds ?? [];
  const policy = live
    ? sessionPolicy(meeting, live.row)
    : policyFromSettings(meeting.settings);
  const asksHosts = member === null && policy.waitingRoom;

  const blocked = checkEntry({
    role,
    settings: meeting.settings,
    passcode: meeting.passcode,
    givenPasscode: input.passcode,
    isMember: member !== null,
    isBanned: member?.bannedAt != null,
    locked: policy.locked,
    waitingRoom: policy.waitingRoom,
    timesDenied:
      live && asksHosts
        ? await timesDenied(live.row.id, principal.mediaUserId)
        : 0,
    hostPresent: connected.some((id) => hostIds.includes(id)),
    connectedCount: connected.length,
    maxParticipants: live?.row.limits.maxParticipants ?? Infinity,
    alreadyConnected: connected.includes(principal.mediaUserId),
  });
  if (blocked === "waiting_for_host") return { state: "waiting_for_host" };
  if (blocked === "waiting_room") {
    // Only reached while a host is in the session, so it's open.
    if (!live) return { state: "waiting_for_host" };
    if (input.canAskHosts === false) throw new MeetingError("RATE_LIMITED");
    const requestId = await askToJoin({
      session: live.row,
      principal,
      name: input.name,
    });
    return { state: "waiting", requestId };
  }
  if (blocked) throw new MeetingError(blocked);

  const session = live ?? {
    row: await startSession(meeting, host, now),
    snapshot: null,
  };
  if (!session.snapshot) {
    // Creating the call is idempotent, so a concurrent join creating it too is fine.
    const { limits } = session.row;
    await mediaProvider(session.row.provider).createSession({
      sessionId: session.row.id,
      host: hostMediaUser(host),
      // Our check holds the real cap; the provider's sits above it as a backstop.
      limits: {
        ...limits,
        maxParticipants: providerParticipantCap(limits.maxParticipants),
      },
      state: sessionState(meeting, session.row, []),
    });
  }

  const admitted = await admit({
    meeting,
    host,
    session: session.row,
    principal,
    name: input.name,
    role,
    now,
  });
  // A co-host the meeting names, new to the session: everyone's room learns it from the
  // session's shared state, as with a co-host made during the meeting.
  if (role === "cohost" && member?.role !== "cohost") {
    try {
      await changeSession(meeting, session.row, { roles: true });
    } catch (error) {
      // They're a co-host either way; the session's next change publishes it.
      console.error("Couldn't publish a named co-host", loggable(error));
    }
  }
  return admitted;
}

/** A fresh media token for someone still admitted to the meeting's open session. */
export async function refreshMeetingToken(input: {
  code: string;
  room: string;
  principal: Principal | null;
}): Promise<string> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const { session, member } = await requireMember(
    meeting.id,
    principal,
    input.room,
  );
  await markSessionSeen(session.id, new Date());

  return mediaProvider(session.provider).refreshToken({
    sessionId: session.id,
    userId: member.mediaUserId,
    role: member.role,
  });
}

/**
 * Someone admitted to the open session is leaving it (or is still in it): it was in use
 * until now. The meeting page says so as it closes, so a session's end is known even
 * where the provider's webhooks don't arrive (a development server, a copy without them).
 */
export async function markSeen(input: {
  code: string;
  principal: Principal | null;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  const { session } = await requireMember(meeting.id, principal);
  await markSessionSeen(session.id, new Date());
}

/** Ends the meeting for everyone (host only). An instant meeting's link stops working. */
export async function endMeetingForAll(input: {
  code: string;
  principal: Principal | null;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  if (principal.kind !== "user" || principal.userId !== meeting.hostId) {
    throw new MeetingError("NOT_ALLOWED");
  }

  const session = await findOpenSession(meeting.id);
  if (session) {
    await closeSession(session.id);
    await mediaProvider(session.provider).endSession(session.id);
  }
  if (meeting.type === "instant") await endMeeting(meeting.id);
}
