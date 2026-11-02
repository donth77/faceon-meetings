import "server-only";

import { pruneExpiredSessions } from "@/lib/account/sessions";
import { pruneAnsweredRequests } from "@/lib/hosting/requests";
import { loggable } from "@/lib/log";
import { pruneAttempts, pruneAuthRateLimits } from "@/lib/rate-limit";
import { pruneSentReminders } from "@/lib/reminders/store";

import { pruneAttendance, pruneWebhookEvents } from "./attendance";
import {
  deleteExpiredMeetings,
  openSessionsStartedBefore,
  pruneEndedSessionMembers,
} from "./queries";
import { daysBefore, KEEP_DAYS } from "./retention";
import { SESSION_GRACE_MS } from "./rules";
import { pruneSavedNotes } from "./saved-notes";
import { currentSession } from "./sessions";
import { pruneEndedSessionRequests } from "./waiting-room";

/**
 * Housekeeping, run on a schedule (and safe to run any time):
 * - closes sessions whose call ended or sat empty past the grace period, ending their
 *   calls, so they don't count as running and old tokens can't rejoin;
 * - deletes expired meetings once nothing of theirs is left in Previous;
 * - drops admission records and waiting-room requests a week after their session ended
 *   (removals after 90 days), attendance and saved AI notes after 90 days, attempt
 *   counters and sign-in rate limits after a day, sign-in sessions once they expire,
 *   answered requests to host full meetings after 90 days, and the records of reminder
 *   emails two days after their meeting. The privacy policy promises these (retention.ts).
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
        console.error("Sweep could not check a session", loggable(error));
        return "error" as const;
      },
    );
    if (result === null || result === "meeting-ended") closedSessions++;
  }

  const history = daysBefore(now, KEEP_DAYS.history);
  const admissions = daysBefore(now, KEEP_DAYS.admissions);
  const counters = daysBefore(now, KEEP_DAYS.counters);
  return {
    closedSessions,
    deletedMeetings: await deleteExpiredMeetings(now),
    prunedMembers: await pruneEndedSessionMembers(admissions, history),
    prunedRequests: await pruneEndedSessionRequests(admissions),
    prunedAttemptCounters: await pruneAttempts(counters),
    prunedAuthRateLimits: await pruneAuthRateLimits(counters),
    prunedSessions: await pruneExpiredSessions(now),
    prunedAttendance: await pruneAttendance(history),
    prunedSavedNotes: await pruneSavedNotes(history),
    prunedWebhookEvents: await pruneWebhookEvents(
      daysBefore(now, KEEP_DAYS.webhookDeliveries),
    ),
    prunedHostingRequests: await pruneAnsweredRequests(
      daysBefore(now, KEEP_DAYS.hostingRequests),
    ),
    prunedReminders: await pruneSentReminders(
      daysBefore(now, KEEP_DAYS.reminders),
    ),
  };
}
