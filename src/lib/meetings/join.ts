import "server-only";

import { avatarUrl } from "@/lib/avatars/seed";
import { mediaProvider, pickProvider } from "@/lib/media";
import type { SessionLimits, SessionSnapshot } from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

import type { JoinResponse } from "./api";
import { MEETING_CODE_PATTERN } from "./codes";
import { MeetingError } from "./errors";
import { userMediaId, type Principal } from "./principal";
import {
  closeSession,
  endMeeting,
  findMeetingByCode,
  findMember,
  findOpenSession,
  hostMemberIds,
  openSession,
  upsertMember,
  type Meeting,
  type MeetingHost,
  type MeetingSession,
} from "./queries";
import { checkEntry, isSessionStale, resolveRole } from "./rules";

/** An open session with what its provider reported (null: its call isn't there yet). */
type LiveSession = { row: MeetingSession; snapshot: SessionSnapshot | null };

/** Limits for a new session. Demo limits for non-allowlisted hosts come later. */
function sessionLimits(): SessionLimits {
  const env = serverEnv();
  return {
    maxParticipants: env.MAX_PARTICIPANTS_PER_MEETING,
    ...(env.MAX_MEETING_MINUTES > 0
      ? { maxDurationSeconds: env.MAX_MEETING_MINUTES * 60 }
      : {}),
  };
}

const isJoinable = (meeting: Meeting, now: Date) =>
  meeting.status === "active" &&
  (meeting.expiresAt === null || meeting.expiresAt > now);

/**
 * The meeting's open session, if it's still usable. A session whose call ended or sat
 * empty past the grace period is closed here (lazy expiry), and an instant meeting whose
 * call ended is over.
 */
async function currentSession(
  meeting: Meeting,
  now: Date,
): Promise<LiveSession | "meeting-ended" | null> {
  const row = await findOpenSession(meeting.id);
  if (!row) return null;
  const provider = mediaProvider(row.provider);
  const snapshot = await provider.inspectSession(row.id);
  if (!isSessionStale(row.startedAt, snapshot, now)) return { row, snapshot };

  await closeSession(row.id);
  if (snapshot?.ended) {
    if (meeting.type === "instant") {
      await endMeeting(meeting.id);
      return "meeting-ended";
    }
  } else if (snapshot) {
    // End the old call, so tokens issued for it can't rejoin it.
    await provider.endSession(row.id);
  }
  return null;
}

const hostMediaUser = (host: MeetingHost) => ({
  id: userMediaId(host.id),
  name: host.name,
  image: avatarUrl(host),
});

async function requireMeeting(code: string) {
  const found = MEETING_CODE_PATTERN.test(code)
    ? await findMeetingByCode(code)
    : null;
  if (!found) throw new MeetingError("NOT_FOUND");
  return found;
}

function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) throw new MeetingError("SIGN_IN_REQUIRED");
  return principal;
}

/**
 * Decides whether someone may join a meeting now and, if so, admits them: opens a session
 * (and its call) when none is open, records the admission and returns a media token.
 * Throws MeetingError when they can't join.
 */
export async function joinMeeting(input: {
  code: string;
  name: string;
  passcode: string | undefined;
  principal: Principal | null;
}): Promise<JoinResponse> {
  const now = new Date();
  const { meeting, host } = await requireMeeting(input.code);
  if (!isJoinable(meeting, now)) throw new MeetingError("ENDED");
  const principal = requirePrincipal(input.principal);

  const live = await currentSession(meeting, now);
  if (live === "meeting-ended") throw new MeetingError("ENDED");

  const [member, hostIds] = live
    ? await Promise.all([
        findMember(live.row.id, principal.mediaUserId),
        hostMemberIds(live.row.id),
      ])
    : [null, []];
  const role = resolveRole({
    isOwner: principal.userId === meeting.hostId,
    memberRole: member?.role,
  });
  const connected = live?.snapshot?.connectedUserIds ?? [];

  const blocked = checkEntry({
    role,
    settings: meeting.settings,
    passcode: meeting.passcode,
    givenPasscode: input.passcode,
    isMember: member !== null,
    isBanned: member?.bannedAt != null,
    hostPresent: connected.some((id) => hostIds.includes(id)),
    connectedCount: connected.length,
    maxParticipants: live?.row.limits.maxParticipants ?? Infinity,
    alreadyConnected: connected.includes(principal.mediaUserId),
  });
  if (blocked === "waiting_for_host") return { state: "waiting_for_host" };
  if (blocked) throw new MeetingError(blocked);

  const session = live ?? {
    row: await openSession({
      meeting,
      provider: pickProvider().id,
      limits: sessionLimits(),
    }),
    snapshot: null,
  };
  const provider = mediaProvider(session.row.provider);
  if (!session.snapshot) {
    // Creating the call is idempotent, so a concurrent join creating it too is fine.
    await provider.createSession({
      sessionId: session.row.id,
      host: hostMediaUser(host),
      limits: session.row.limits,
    });
  }

  const self = {
    id: principal.mediaUserId,
    name: input.name,
    image: principal.image,
    role,
  };
  await upsertMember({
    sessionId: session.row.id,
    mediaUserId: self.id,
    userId: principal.userId,
    displayName: self.name,
    role,
  });
  const connection = await provider.admit({
    sessionId: session.row.id,
    user: self,
    role,
  });

  return {
    state: "admitted",
    connection,
    self,
    meeting: {
      code: meeting.code,
      title: meeting.title,
      passcode: meeting.passcode,
      hostName: host.name,
    },
  };
}

/** A fresh media token for someone still admitted to the meeting's open session. */
export async function refreshMeetingToken(input: {
  code: string;
  room: string;
  principal: Principal | null;
}): Promise<string> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);

  const session = await findOpenSession(meeting.id);
  if (!session || session.id !== input.room) {
    throw new MeetingError("SESSION_ENDED");
  }
  const member = await findMember(session.id, principal.mediaUserId);
  if (!member || member.bannedAt) throw new MeetingError("NOT_ALLOWED");

  return mediaProvider(session.provider).refreshToken({
    sessionId: session.id,
    userId: member.mediaUserId,
    role: member.role,
  });
}

/** Ends the meeting for everyone (host only). An instant meeting's link stops working. */
export async function endMeetingForAll(input: {
  code: string;
  principal: Principal | null;
}): Promise<void> {
  const { meeting } = await requireMeeting(input.code);
  const principal = requirePrincipal(input.principal);
  if (principal.userId !== meeting.hostId)
    throw new MeetingError("NOT_ALLOWED");

  const session = await findOpenSession(meeting.id);
  if (session) {
    await closeSession(session.id);
    await mediaProvider(session.provider).endSession(session.id);
  }
  if (meeting.type === "instant") await endMeeting(meeting.id);
}
