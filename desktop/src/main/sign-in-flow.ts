import { createHash, randomBytes } from "node:crypto";

/** How long a sign-in started in the browser may take to come back. */
export const SIGN_IN_TTL_MS = 10 * 60 * 1000;

/** A PKCE-style pair: the app keeps the verifier; the browser and server see the challenge. */
export const newVerifier = () => randomBytes(32).toString("base64url");
export const challengeFor = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");
export const newState = () => randomBytes(24).toString("base64url");

/**
 * Sign-ins started from the app and not yet back. Each state is used once, and expires,
 * so a faceon://auth link the app didn't ask for (or asked for long ago) does nothing.
 */
export class PendingSignIns {
  private readonly pending = new Map<
    string,
    { verifier: string; at: number }
  >();

  start(now: number): { state: string; challenge: string } {
    this.prune(now);
    const state = newState();
    const verifier = newVerifier();
    this.pending.set(state, { verifier, at: now });
    return { state, challenge: challengeFor(verifier) };
  }

  /** The verifier for this state, once; null if unknown or too old. */
  take(state: string, now: number): string | null {
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (!entry || now - entry.at > SIGN_IN_TTL_MS) return null;
    return entry.verifier;
  }

  private prune(now: number) {
    for (const [state, { at }] of this.pending) {
      if (now - at > SIGN_IN_TTL_MS) this.pending.delete(state);
    }
  }
}
