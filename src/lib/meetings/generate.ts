import "server-only";

import { randomInt } from "node:crypto";

import { randomPasscode } from "./codes";

/** A new 10-digit meeting ID with a non-zero first digit. Never sequential. */
export function generateMeetingCode(): string {
  let code = String(randomInt(1, 10));
  for (let i = 0; i < 9; i++) code += String(randomInt(0, 10));
  return code;
}

/** A new 6-character passcode (the same as the schedule form's Generate makes). */
export const generatePasscode = randomPasscode;
