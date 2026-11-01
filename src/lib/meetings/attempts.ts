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

/** Per caller and per meeting, so guessing is slow both ways. */
export function joinAttemptLimits(
  request: Request,
  code: string,
): AttemptLimit[] {
  return [
    { key: `join:ip:${hashedClientIp(request)}`, max: 10 },
    { key: `join:meeting:${code}`, max: 20 },
  ];
}
