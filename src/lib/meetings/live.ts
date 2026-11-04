/**
 * The green Live dot on Home and in Upcoming, as plain functions the server and the
 * browser share: which listed occurrence a live meeting is running, and whether a page
 * should keep checking. Whether a meeting is live at all is isSessionLive (rules.ts).
 */

/** An occurrence's key: its meeting's code and its planned start. */
export function occurrenceKey(
  code: string,
  originalStart: Date | string,
): string {
  return `${code}:${new Date(originalStart).toISOString()}`;
}

/**
 * Which listed occurrences live meetings are running: for each meeting, the occurrence
 * under way, or else the one nearest now (it ran over, or started early). A live
 * meeting with nothing listed gets no key.
 */
export function liveOccurrenceKeys(
  rows: readonly {
    code: string;
    start: Date;
    end: Date;
    originalStart: Date;
  }[],
  liveCodes: ReadonlySet<string>,
  now: Date,
): Set<string> {
  const nearest = new Map<string, { key: string; distance: number }>();
  for (const row of rows) {
    if (!liveCodes.has(row.code)) continue;
    const distance = Math.max(
      0,
      row.start.getTime() - now.getTime(),
      now.getTime() - row.end.getTime(),
    );
    const best = nearest.get(row.code);
    if (!best || distance < best.distance) {
      nearest.set(row.code, {
        key: occurrenceKey(row.code, row.originalStart),
        distance,
      });
    }
  }
  return new Set([...nearest.values()].map(({ key }) => key));
}

/** People start looking for a meeting about ten minutes before it starts. */
const DUE_BEFORE_MS = 10 * 60_000;

/**
 * Whether a page should keep checking for Live dots: one of its meetings is live, or
 * is due (from ten minutes before its start until its end), so it may start any moment.
 */
export function worthWatching(
  rows: readonly { start: string; end: string; live: boolean }[],
  now: number,
): boolean {
  return rows.some(
    (row) =>
      row.live ||
      (now >= Date.parse(row.start) - DUE_BEFORE_MS &&
        now < Date.parse(row.end)),
  );
}
