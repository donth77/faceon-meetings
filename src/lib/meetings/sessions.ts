import "server-only";

import { hostingPlanOf } from "@/lib/hosting/access";
import { loggable } from "@/lib/log";
import { mediaProvider, pickProvider } from "@/lib/media";
import type { SessionSnapshot } from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

import { MeetingError } from "./errors";
import { limitsFor } from "./hosting";
import {
  closeSession,
  countOpenSessions,
  countSessionsSince,
  endMeeting,
  findOpenSession,
  openMeetingsFor,
  openSession,
  type Meeting,
  type MeetingHost,
  type MeetingSession,
} from "./queries";
import { isSessionLive, isSessionStale, sessionEndedAt } from "./rules";
import { keepOpenSeriesAlive } from "./scheduling";

/**
 * Meeting sessions: opening one (with the host's limits and the platform's caps),
 * checking an open one is still usable, and which meetings are live. Used by joining,
 * by the scheduled sweep, and by Home and Upcoming for their green Live dots.
 */

/** An open session with what its provider reported (null: its call isn't there yet). */
export type LiveSession = {
  row: MeetingSession;
  snapshot: SessionSnapshot | null;
};

/** A day, for the daily caps. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Opens a session with the host's limits: full for allowlisted hosts, demo otherwise.
 * A demo host has a few sessions a day, and only so many meetings run at once.
 */
export async function startSession(
  meeting: Meeting,
  host: MeetingHost,
  now: Date,
) {
  if ((await countOpenSessions(now)) >= serverEnv().MAX_CONCURRENT_MEETINGS) {
    throw new MeetingError("BUSY");
  }
  const plan = await hostingPlanOf(host);
  if (plan === "demo") {
    const today = await countSessionsSince(
      host.id,
      new Date(now.getTime() - DAY_MS),
    );
    if (today >= serverEnv().DEMO_MEETINGS_PER_DAY) {
      throw new MeetingError("DEMO_LIMIT");
    }
  }
  const session = await openSession({
    meeting,
    provider: pickProvider().id,
    limits: limitsFor(plan),
  });
  await keepOpenSeriesAlive(meeting, now);
  return session;
}

/**
 * Demo meetings the host can still start in the last day's window; null for hosts with
 * full meetings, who aren't counted.
 */
export async function demoMeetingsLeft(
  host: { id: string; email: string; emailVerified: boolean },
  now: Date,
): Promise<number | null> {
  if ((await hostingPlanOf(host)) === "full") return null;
  const today = await countSessionsSince(
    host.id,
    new Date(now.getTime() - DAY_MS),
  );
  return Math.max(0, serverEnv().DEMO_MEETINGS_PER_DAY - today);
}

/** Seconds until the session's time limit, from its start; null without a limit. */
export function secondsLeft(session: MeetingSession, now: Date): number | null {
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
export async function currentSession(
  meeting: Meeting,
  now: Date,
): Promise<LiveSession | "meeting-ended" | null> {
  const row = await findOpenSession(meeting.id);
  if (!row) return null;
  const provider = mediaProvider(row.provider);
  const snapshot = await provider.inspectSession(row.id);
  if (!isSessionStale(row.startedAt, snapshot, now)) return { row, snapshot };

  await closeSession(row.id, sessionEndedAt(row, snapshot, now));
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

/** A meeting that's live now (isSessionLive), and since when its session has run. */
export type LiveMeeting = { meeting: Meeting; since: Date };

/**
 * Someone's meetings that are live now, for the green dots on Home and in Upcoming: of
 * their own and those they're invited to, each with an open session is looked at as a
 * join would (currentSession, which also closes one that's no longer usable). A call
 * that can't be looked at counts as not live.
 */
export async function liveMeetingsFor(
  viewer: { id: string; email: string; emailVerified: boolean },
  now: Date,
): Promise<LiveMeeting[]> {
  const candidates = await openMeetingsFor({
    userId: viewer.id,
    verifiedEmail: viewer.emailVerified ? viewer.email : null,
  });
  const checked = await Promise.all(
    candidates.map(async (meeting): Promise<LiveMeeting | null> => {
      const current = await currentSession(meeting, now).catch(
        (error: unknown) => {
          console.error("Could not check a meeting's call.", loggable(error));
          return null;
        },
      );
      if (!current || current === "meeting-ended") return null;
      return isSessionLive(current.row, current.snapshot, now)
        ? { meeting, since: current.row.startedAt }
        : null;
    }),
  );
  return checked.filter((live) => live !== null);
}
