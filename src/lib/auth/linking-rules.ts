import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "@/lib/zod";

/*
 * Which Google or GitHub accounts may be linked to a FaceOn account. Better Auth links a
 * provider account in two ways: at sign-in, to the account with the same email, and
 * from Settings (linkSocial), to the signed-in account. Both pass `decideLink`
 * (Better Auth's `validateUserInfo`, lib/auth/linking.ts):
 *
 * - The provider must say it verified the email. No provider is trusted by name, so
 *   Better Auth checks this too before linking at sign-in.
 * - The same email links, as before.
 * - A Google account with a different email links only from Settings, when the person
 *   confirmed it within minutes of signing in: POST /api/integrations/google-link sets
 *   a short-lived cookie for that session, and only a link made with it passes. Calendar
 *   sync and the add-on often live in a personal Google account, but a browser someone
 *   left signed in mustn't let another person attach their own Google account.
 */

/** Better Auth's account-linking settings (lib/auth/server.ts). */
export const ACCOUNT_LINKING = {
  enabled: true,
  // Google or GitHub may link to an account whose email was never verified; the
  // database hook drops that account's password first (lib/auth/linking.ts).
  requireLocalEmailVerified: false,
  // Better Auth's own same-email check is off: `decideLink` makes it, and allows the
  // exception above.
  allowDifferentEmails: true,
};

/** The cookie that carries the person's go-ahead to Better Auth's callback. */
export const LINK_INTENT_COOKIE = "faceon_link_any_email";
/** Only Better Auth's routes need it: Google's callback lands there. */
export const LINK_INTENT_PATH = "/api/auth";
/** How recent the sign-in must be, and how long the go-ahead lasts. */
export const FRESH_SIGN_IN_MS = 10 * 60_000;

const PURPOSE = "link-any-email";
const Payload = z.object({
  p: z.literal(PURPOSE),
  u: z.string().min(1),
  s: z.string().min(1),
  e: z.number().int(),
});

/** Whether a session started recently enough to connect a different-email account. */
export function isFreshSignIn(signedInAt: Date, now: Date): boolean {
  const age = now.getTime() - signedInAt.getTime();
  return age >= -60_000 && age <= FRESH_SIGN_IN_MS;
}

const signature = (payload: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`${PURPOSE}.${payload}`)
    .digest("base64url");

/** The go-ahead for one session of one account, good for FRESH_SIGN_IN_MS. */
export function linkIntentToken(intent: {
  userId: string;
  sessionId: string;
  now: Date;
  secret: string;
}): string {
  if (!intent.secret) throw new Error("A secret is required.");
  const payload = Buffer.from(
    JSON.stringify({
      p: PURPOSE,
      u: intent.userId,
      s: intent.sessionId,
      e: intent.now.getTime() + FRESH_SIGN_IN_MS,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload, intent.secret)}`;
}

/** Whether `token` is a genuine, unexpired go-ahead for this session of this account. */
export function readLinkIntent(
  token: unknown,
  expected: { userId: string; sessionId: string; now: Date; secret: string },
): boolean {
  if (!expected.secret || typeof token !== "string" || token.length > 1024) {
    return false;
  }
  const [payload, given, extra] = token.split(".");
  if (!payload || !given || extra !== undefined) return false;
  const want = Buffer.from(signature(payload, expected.secret));
  const got = Buffer.from(given);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const parsed = Payload.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return (
      parsed.success &&
      parsed.data.u === expected.userId &&
      parsed.data.s === expected.sessionId &&
      expected.now.getTime() <= parsed.data.e
    );
  } catch {
    return false;
  }
}

/** Two email addresses are the same one, ignoring case and spaces around them. */
export function sameAddress(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = a.trim().toLowerCase();
  return left !== "" && left === b.trim().toLowerCase();
}

/** Better Auth's codes for a refused link, which come back to the page as `?error=`. */
export type LinkVerdict =
  | "allow"
  | "email_not_verified"
  | "email_does_not_match"
  | "unable_to_link_account";

/** What Better Auth says it's about to do (validateUserInfo's data). */
export type LinkAttempt = {
  action: string;
  providerId: string;
  /** The provider account's email and whether the provider verified it. */
  providerEmail: unknown;
  providerEmailVerified: unknown;
  /** The FaceOn account it would join. */
  userId: string;
};

/** What `decideLink` needs to know about the request and the account. */
export type LinkFacts = {
  /** The FaceOn account's email, or null when there's no such account. */
  accountEmail(userId: string): Promise<string | null>;
  /** The session making the request, read from the database. */
  session(): Promise<{ userId: string; sessionId: string } | null>;
  /** The go-ahead cookie's value, if the request has one. */
  intent(): string | undefined;
};

/** Whether a provider account may be linked to a FaceOn account (see above). */
export async function decideLink(
  attempt: LinkAttempt,
  facts: LinkFacts,
  options: { now: Date; secret: string },
): Promise<LinkVerdict> {
  if (attempt.action !== "link-account") return "allow";
  if (attempt.providerEmailVerified !== true) return "email_not_verified";
  const accountEmail = await facts.accountEmail(attempt.userId);
  if (accountEmail === null) return "unable_to_link_account";
  if (sameAddress(attempt.providerEmail, accountEmail)) return "allow";
  if (attempt.providerId !== "google") return "email_does_not_match";
  const session = await facts.session();
  if (!session || session.userId !== attempt.userId) {
    return "email_does_not_match";
  }
  return readLinkIntent(facts.intent(), {
    userId: attempt.userId,
    sessionId: session.sessionId,
    now: options.now,
    secret: options.secret,
  })
    ? "allow"
    : "email_does_not_match";
}
