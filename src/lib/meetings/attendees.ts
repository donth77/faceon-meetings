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

/** One person's visits added up, by media ID: for Previous, and for exports. */
export type PersonVisits = {
  mediaUserId: string;
  name: string;
  image: string | null;
  /** Their first join and last leave. */
  joined: Date;
  left: Date;
  /** The time they were here, visits added up. */
  minutes: number;
  /** Each time they joined and left, in order. */
  visits: Array<{ joinedAt: string; leftAt: string }>;
};

/**
 * Everyone's visits added up per person (by media ID), first to arrive first. Joins and
 * leaves come from different clocks, so a leave a few seconds before its join counts as
 * the join.
 */
export function groupVisits(visits: Visit[]): PersonVisits[] {
  const people = new Map<string, PersonVisits>();
  for (const { mediaUserId, name, image, joinedAt: joined, leftAt } of visits) {
    const left = leftAt < joined ? joined : leftAt;
    const visit = {
      joinedAt: joined.toISOString(),
      leftAt: left.toISOString(),
    };
    const current = people.get(mediaUserId);
    if (current) {
      current.visits.push(visit);
      if (joined < current.joined) current.joined = joined;
      if (left > current.left) current.left = left;
      current.minutes += minutesBetween(joined, left);
      continue;
    }
    people.set(mediaUserId, {
      mediaUserId,
      name,
      image,
      joined,
      left,
      minutes: minutesBetween(joined, left),
      visits: [visit],
    });
  }
  return [...people.values()]
    .map((person) => ({
      ...person,
      visits: person.visits.sort((a, b) =>
        a.joinedAt.localeCompare(b.joinedAt),
      ),
    }))
    .sort((a, b) => a.joined.getTime() - b.joined.getTime());
}

/** When the first person came and the last one left; null with nobody. */
export function spanOf(people: PersonVisits[]): {
  start: Date | null;
  end: Date | null;
} {
  if (people.length === 0) return { start: null, end: null };
  return {
    start: new Date(Math.min(...people.map((p) => p.joined.getTime()))),
    end: new Date(Math.max(...people.map((p) => p.left.getTime()))),
  };
}

/**
 * One entry per person, first to arrive first, their visits added up. "You" and "Host"
 * come from media IDs, which last as long as the attendance (admission records don't).
 * Also returns when the first person came and the last one left (null with nobody).
 */
export function attendeesOf(
  visits: Visit[],
  who: { viewerMediaId: string; hostMediaId: string },
): { attendees: Attendee[]; start: Date | null; end: Date | null } {
  const people = groupVisits(visits);
  const attendees = people.map((person) => ({
    name: person.name,
    image: person.image,
    // One visit says no more than joined and left do.
    visits: person.visits.length > 1 ? person.visits : [],
    isHost: person.mediaUserId === who.hostMediaId,
    isGuest: isGuestMediaId(person.mediaUserId),
    isYou: person.mediaUserId === who.viewerMediaId,
    joinedAt: person.joined.toISOString(),
    leftAt: person.left.toISOString(),
    minutes: person.minutes,
  }));
  return { attendees, ...spanOf(people) };
}

/** Guests' media IDs start with "g_" (signed-in people's with "u_"). */
export const isGuestMediaId = (mediaUserId: string) =>
  mediaUserId.startsWith("g_");
