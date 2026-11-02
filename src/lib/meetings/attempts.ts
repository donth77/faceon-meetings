import "server-only";

import { hashedClientIp, type AttemptLimit } from "@/lib/rate-limit";

import type { MeetingErrorCode } from "./api";

/**
 * Only failed joins count: a wrong passcode or an unknown meeting ID. Successful joins,
 * token refreshes and rejoins never do, so a flaky connection can't lock anyone out.
 */
export const FAILED_JOIN: ReadonlySet<MeetingErrorCode> = new Set([
  "BAD_PASSCODE",
  "NOT_FOUND",
]);

type Caller = Request | Pick<Headers, "get">;

/** One budget per caller for guessing, shared by the join API and the meeting page. */
const guessesBy = (caller: Caller): AttemptLimit => ({
  key: `join:ip:${hashedClientIp(caller)}`,
  max: 10,
});

/** Per caller and per meeting, so guessing is slow both ways. */
export function joinAttemptLimits(
  request: Request,
  code: string,
): AttemptLimit[] {
  return [guessesBy(request), { key: `join:meeting:${code}`, max: 20 }];
}

/**
 * Opening /j/{ID} for a meeting that doesn't exist counts as a failed join too, so the
 * page isn't a faster way to find meeting IDs than the join API. Each unknown ID counts
 * once per caller (`seen`): pages render more than once per request.
 */
export function meetingPageAttempts(headers: Caller, code: string) {
  const guesses = guessesBy(headers);
  return {
    limits: [guesses],
    seen: `${guesses.key}:${code.slice(0, 32)}`,
  };
}

/**
 * Asking to join through the waiting room, per caller: generous for many people behind
 * one address, but a stream of fresh guest identities can't flood the hosts' list.
 */
export const waitingRoomLimits = (request: Request): AttemptLimit[] => [
  { key: `lobby:ip:${hashedClientIp(request)}`, max: 20 },
];
