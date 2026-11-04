import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "@/lib/zod";

/**
 * The link in a reminder email that turns reminder emails off: who it's for, signed so
 * nobody can make one for someone else. It does nothing else, so it never expires; it
 * still works after reminders are turned back on, and turns them off again.
 */
const PURPOSE = "email-reminders-off";
const Payload = z.object({ p: z.literal(PURPOSE), u: z.string().min(1) });

const signature = (payload: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`${PURPOSE}.${payload}`)
    .digest("base64url");

export function unsubscribeToken(userId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ p: PURPOSE, u: userId }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

/** The account a genuine token is for; null for anything else. */
export function readUnsubscribeToken(
  token: unknown,
  secret: string,
): string | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const [payload, given, extra] = token.split(".");
  if (!payload || !given || extra !== undefined) return null;
  const expected = Buffer.from(signature(payload, secret));
  const received = Buffer.from(given);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null;
  }
  try {
    const parsed = Payload.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data.u : null;
  } catch {
    return null;
  }
}
