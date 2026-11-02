/** A meeting coming up, as /api/desktop/upcoming lists it. */
export type UpcomingMeeting = {
  /** Stable for each occurrence (a series' meetings differ by start). */
  id: string;
  title: string;
  /** ISO 8601. */
  startsAt: string;
  /** Where Join goes, e.g. "/j/1234567890". */
  path: string;
};

export type DueReminder = { key: string; meeting: UpcomingMeeting };

const keyOf = (meeting: UpcomingMeeting) => `${meeting.id}@${meeting.startsAt}`;

/**
 * The reminders to show now: meetings starting within `minutes`, not started yet, and
 * not reminded of before. Off (0) shows none.
 */
export function dueReminders(
  meetings: readonly UpcomingMeeting[],
  minutes: number,
  now: number,
  shown: ReadonlySet<string>,
): DueReminder[] {
  if (minutes <= 0) return [];
  return meetings.flatMap((meeting) => {
    const start = Date.parse(meeting.startsAt);
    if (!Number.isFinite(start)) return [];
    const key = keyOf(meeting);
    const due = now >= start - minutes * 60_000 && now < start;
    return due && !shown.has(key) ? [{ key, meeting }] : [];
  });
}

/** The next meeting not long started, for the tray's Join item. */
export function nextMeeting(
  meetings: readonly UpcomingMeeting[],
  now: number,
): UpcomingMeeting | null {
  let next: UpcomingMeeting | null = null;
  for (const meeting of meetings) {
    const start = Date.parse(meeting.startsAt);
    if (!Number.isFinite(start) || start + 5 * 60_000 < now) continue;
    if (!next || start < Date.parse(next.startsAt)) next = meeting;
  }
  return next;
}
