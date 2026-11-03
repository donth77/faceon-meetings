import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { CHALLENGE } from "./handoff-params";

/**
 * Signing the desktop app in through the browser. The app keeps a random verifier and
 * sends only its SHA-256, the challenge. The browser, signed in, asks for a one-time
 * token tied to that challenge and hands it to the app through faceon://auth. The app
 * proves it's the one that asked by sending the verifier with the token. A token that
 * leaks without the verifier is useless; it works once, for a minute.
 */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9_-]{43,128}$/;
/**
 * Ten minutes. Between the token and the app, the browser asks whether to open the app
 * ("Open FaceOn?"), and a first-time prompt can take a person a while: at a minute, slow
 * readers found the token gone. The verifier keeps a longer life safe.
 */
export const HANDOFF_TTL_MS = 10 * 60 * 1000;

export const handoffExpiresAt = (now: number) => new Date(now + HANDOFF_TTL_MS);

/** Whether a stored token can still be used. */
export const handoffUsable = (expiresAt: Date, now: number) =>
  expiresAt.getTime() > now;

export const newHandoffToken = () => randomBytes(32).toString("base64url");

/** Where a token is kept: as its hash, so the database never holds a usable one. */
/** A used hand-off, remembered for the rest of its life: asked for again, it goes Home. */
export const handoffUsedKey = (token: string) =>
  `desktop-handoff-used:${hashToken(token)}`;

export const handoffKey = (token: string) =>
  `desktop-handoff:${hashToken(token)}`;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export const HandoffRecord = z.object({
  userId: z.string().min(1).max(200),
  challenge: z.string().regex(CHALLENGE),
});

/** Whether the verifier is the one this challenge was made from (S256, as in PKCE). */
export function challengeMatches(challenge: string, verifier: string): boolean {
  if (!CHALLENGE.test(challenge) || !VERIFIER.test(verifier)) return false;
  const expected = Buffer.from(
    createHash("sha256").update(verifier).digest("base64url"),
  );
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The app's X-FaceOn-Handoff header, "<token>.<verifier>", or null if it isn't one. */
export function readHandoff(
  header: string | null | undefined,
): { token: string; verifier: string } | null {
  const [token, verifier, ...rest] = (header ?? "").trim().split(".");
  if (rest.length > 0 || !token || !verifier) return null;
  return TOKEN.test(token) && VERIFIER.test(verifier)
    ? { token, verifier }
    : null;
}
