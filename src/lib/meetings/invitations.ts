/**
 * The invitation rows for a meeting: invitees, and named co-hosts (invited too). An
 * address on both lists is a co-host. They keep the order they were added in (a co-host
 * named only as one comes after), each a moment apart, so they read back that way.
 */
export function invitationRows(
  meetingId: string,
  invitees: readonly string[],
  cohosts: readonly string[],
  at: number = Date.now(),
) {
  const named = new Set(cohosts);
  return [...new Set([...invitees, ...cohosts])].map((email, index) => ({
    meetingId,
    email,
    cohost: named.has(email),
    addedAt: new Date(at + index),
  }));
}
