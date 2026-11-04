import "server-only";

import { createHash } from "node:crypto";

import type { Email } from "@/lib/email/send";

/** A hash of an email as it will go: a change to any of it means a new email. */
export function fingerprintOf(email: Email): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        email.to,
        email.subject,
        email.text,
        email.html,
        email.headers ?? null,
      ]),
    )
    .digest("base64url")
    .slice(0, 32);
}

/**
 * Resend's idempotency key for one scheduled reminder email: a retry with it gets the email
 * the first try made. The nonce is new for each email, so one made again after a cancel
 * (with the same content) is a new email, not the cancelled one.
 */
export function idempotencyKey(
  key: { userId: string; meetingCode: string; startsAt: Date },
  nonce: string,
): string {
  const hash = createHash("sha256")
    .update(
      `${key.userId}|${key.meetingCode}|${key.startsAt.toISOString()}|${nonce}`,
    )
    .digest("base64url");
  return `reminder/${hash}`;
}
