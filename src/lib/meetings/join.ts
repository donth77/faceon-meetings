import "server-only";

import { avatarUrl } from "@/lib/avatars/seed";
import { guestsEnabled } from "@/lib/guest-session";
import { mediaProvider, pickProvider } from "@/lib/media";
import type { SessionSnapshot } from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

import type { JoinResponse } from "./api";
import { MEETING_CODE_PATTERN } from "./codes";
import { MeetingError } from "./errors";
import { hostingPlan, limitsFor } from "./hosting";
import { userMediaId, type Principal } from "./principal";
import {
  closeSession,
  countSessionsSince,
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
import { checkEntry, isJoinable, isSessionStale, resolveRole } from "./rules";

/** An open session with what its provider reported (null: its call isn't there yet). */
type LiveSession = { row: MeetingSession; snapshot: SessionSnapshot | null };

/** A day, for the daily caps. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Opens a session with the host's limits: full for allowlisted hosts, demo otherwise.
 * A demo host has a few sessions a day.
 */
async function startSession(meeting: Meeting, host: MeetingHost, now: Date) {
  const plan = hostingPlan(host);
  if (plan === "demo") {
    const today = await countSessionsSince(
      host.id,
      new Date(now.getTime() - DAY_MS),
    );
    if (today >= serverEnv().DEMO_MEETINGS_PER_DAY) {
      throw new MeetingError("DEMO_LIMIT");
    }
  }
  return openSession({
    meeting,
    provider: pickProvider().id,
    limits: limitsFor(plan),
  });
}

/** Seconds until the session's time limit, from its start; null without a limit. */
function secondsLeft(session: MeetingSession, now: Date): number | null {
  const max = session.limits.maxDurationSeconds;
  if (!max) return null;
  const elapsed = (now.getTime() - session.startedAt.getTime()) / 1000;
  return Math.max(0, Math.round(max - elapsed));
}

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
    row: await startSession(meeting, host, now),
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
    userId: principal.kind === "user" ? principal.userId : null,
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
      muteOnEntry: meeting.settings.muteOnEntry,
      videoOffOnEntry: meeting.settings.videoOffOnEntry,
    },
    session: {
      demo: session.row.limits.demo === true,
      maxParticipants: session.row.limits.maxParticipants,
      maxMinutes: session.row.limits.maxDurationSeconds
        ? Math.round(session.row.limits.maxDurationSeconds / 60)
        : null,
      secondsLeft: secondsLeft(session.row, now),
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
