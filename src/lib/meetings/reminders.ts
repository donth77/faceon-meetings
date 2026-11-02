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
