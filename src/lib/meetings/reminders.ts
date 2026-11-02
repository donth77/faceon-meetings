/** A reminder's key: one per meeting occurrence, by its ID and start. */
export function reminderKey(occurrence: {
  code: string;
  start: string;
}): string {
  return `${occurrence.code}@${occurrence.start}`;
}

/**
 * Reminders on screen whose meeting isn't coming up any more: it was deleted, or moved
 * to another time (its key changes with its start).
 */
export function staleReminders(
  showing: Iterable<string>,
  upcoming: readonly { code: string; start: string }[],
): string[] {
  const current = new Set(upcoming.map(reminderKey));
  return [...showing].filter((key) => !current.has(key));
}

/**
 * Which reminders to set from here, and in how long: each meeting still to start whose
 * reminder falls before the next look (`horizon`). A reminder whose time has already
 * passed shows at once where `late` allows it (FaceOn opened, or came back, after it),
 * and not for a meeting just scheduled or moved here: that needs no reminder that it's
 * about to start.
 */
export function remindersDue<
  Row extends { code: string; start: string },
>(input: {
  rows: readonly Row[];
  now: number;
  /** How long before a meeting its reminder shows, in minutes. */
  minutes: number;
  horizon: number;
  late: (row: Row) => boolean;
}): Array<{ row: Row; wait: number }> {
  const due: Array<{ row: Row; wait: number }> = [];
  for (const row of input.rows) {
    const start = new Date(row.start).getTime();
    if (start <= input.now) continue;
    const at = start - input.minutes * 60_000;
    if (at > input.now + input.horizon) continue;
    if (at <= input.now && !input.late(row)) continue;
    due.push({ row, wait: Math.max(0, at - input.now) });
  }
  return due;
}
