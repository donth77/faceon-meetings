/**
 * Who came to a past session and for how long, for Previous. Pure, so it's tested on
 * its own; history.ts feeds it the session's attendance.
 */

/** One connection (or, before any attendance arrived, one admission). */
export type Visit = {
  mediaUserId: string;
  name: string;
  image: string | null;
  joinedAt: Date;
  leftAt: Date;
};

/** Someone who came to a past meeting, with their first join and last leave. */
export type Attendee = {
  name: string;
  image: string | null;
  /** Each time they joined and left, when they came more than once. */
  visits: Array<{ joinedAt: string; leftAt: string }>;
  isHost: boolean;
  isGuest: boolean;
  isYou: boolean;
  joinedAt: string;
  leftAt: string;
  minutes: number;
};

export const minutesBetween = (from: Date, to: Date) =>
  Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));

/**
 * One entry per person, first to arrive first, their visits added up. "You" and "Host"
 * come from media IDs, which last as long as the attendance (admission records don't).
 * Also returns when the first person came and the last one left (null with nobody).
 */
export function attendeesOf(
  visits: Visit[],
  who: { viewerMediaId: string; hostMediaId: string },
): { attendees: Attendee[]; start: Date | null; end: Date | null } {
  const people = new Map<string, Attendee & { joined: Date; left: Date }>();
  for (const { mediaUserId, name, image, joinedAt: joined, leftAt } of visits) {
    // Joins and leaves come from different clocks; a few seconds apart can't put the
    // leave before the join.
    const left = leftAt < joined ? joined : leftAt;
    const minutes = minutesBetween(joined, left);
    const visit = {
      joinedAt: joined.toISOString(),
      leftAt: left.toISOString(),
    };
    const current = people.get(mediaUserId);
    if (current) {
      current.visits.push(visit);
      if (joined < current.joined) current.joined = joined;
      if (left > current.left) current.left = left;
      current.minutes += minutes;
      continue;
    }
    people.set(mediaUserId, {
      name,
      image,
      isHost: mediaUserId === who.hostMediaId,
      isGuest: mediaUserId.startsWith("g_"),
      isYou: mediaUserId === who.viewerMediaId,
      visits: [visit],
      joinedAt: "",
      leftAt: "",
      minutes,
      joined,
      left,
    });
  }

  const sorted = [...people.values()].sort(
    (a, b) => a.joined.getTime() - b.joined.getTime(),
  );
  const attendees = sorted.map(({ joined, left, visits: own, ...person }) => ({
    ...person,
    // One visit says no more than joined and left do.
    visits:
      own.length > 1
        ? own.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        : [],
    joinedAt: joined.toISOString(),
    leftAt: left.toISOString(),
  }));
  if (sorted.length === 0) return { attendees, start: null, end: null };
  return {
    attendees,
    start: new Date(Math.min(...sorted.map((p) => p.joined.getTime()))),
    end: new Date(Math.max(...sorted.map((p) => p.left.getTime()))),
  };
}
