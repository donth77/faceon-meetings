import "server-only";

import { pruneAttempts } from "@/lib/rate-limit";

import {
  deleteExpiredMeetings,
  openSessionsStartedBefore,
  pruneEndedSessionMembers,
} from "./queries";
import { SESSION_GRACE_MS } from "./rules";
import { currentSession } from "./sessions";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Housekeeping, run on a schedule (and safe to run any time):
 * - closes sessions whose call ended or sat empty past the grace period, ending their
 *   calls, so they don't count as running and old tokens can't rejoin;
 * - deletes instant meetings unused for 30 days (their expiry);
 * - drops admission records a week after their session ended, and old attempt counters.
 */
export async function sweep(now = new Date()) {
  let closedSessions = 0;
  const candidates = await openSessionsStartedBefore(
    new Date(now.getTime() - SESSION_GRACE_MS),
  );
  for (const meeting of candidates) {
    // currentSession closes the session when it's no longer usable.
    const result = await currentSession(meeting, now).catch(
      (error: unknown) => {
        console.error("Sweep could not check a session", error);
        return "error" as const;
      },
    );
    if (result === null || result === "meeting-ended") closedSessions++;
  }

  return {
    closedSessions,
    deletedMeetings: await deleteExpiredMeetings(now),
    prunedMembers: await pruneEndedSessionMembers(
      new Date(now.getTime() - 7 * DAY_MS),
    ),
    prunedAttemptCounters: await pruneAttempts(
      new Date(now.getTime() - DAY_MS),
    ),
  };
}
