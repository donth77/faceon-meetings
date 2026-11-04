/**
 * How long FaceOn keeps each kind of record, as the privacy policy says. The daily sweep
 * (sweep.ts) deletes what's older.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export const KEEP_DAYS = {
  /** Previous: attendance, sessions and the AI notes saved to them. */
  history: 90,
  /** Admissions (except removals) and waiting-room requests, after their session ended. */
  admissions: 7,
  /** Webhook deliveries, kept to ignore the provider's retries. */
  webhookDeliveries: 7,
  /** Failed-attempt counters and sign-in rate limits. */
  counters: 1,
  /** Requests to host full meetings, after an admin answered them. */
  hostingRequests: 90,
  /** Records of reminder emails sent, after the meeting's start (so none goes twice). */
  reminders: 2,
  /** The usage meter's daily email counts and the usage warnings sent: counts only. */
  usage: 62,
} as const;

/** The moment `days` days before `now`. */
export const daysBefore = (now: Date, days: number) =>
  new Date(now.getTime() - days * DAY_MS);
