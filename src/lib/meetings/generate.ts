import "server-only";

import { randomInt } from "node:crypto";

/** A new 10-digit meeting ID with a non-zero first digit. Never sequential. */
export function generateMeetingCode(): string {
  let code = String(randomInt(1, 10));
  for (let i = 0; i < 9; i++) code += String(randomInt(0, 10));
  return code;
}

/** Passcode alphabet without look-alikes (no 0/O, 1/l/I). */
const PASSCODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A new 6-character passcode. */
export function generatePasscode(): string {
  let passcode = "";
  for (let i = 0; i < 6; i++) {
    passcode += PASSCODE_ALPHABET[randomInt(0, PASSCODE_ALPHABET.length)];
  }
  return passcode;
}
