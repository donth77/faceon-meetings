import { describe, expect, it } from "vitest";

import {
  challengeMatches,
  handoffExpiresAt,
  handoffKey,
  handoffUsable,
  newHandoffToken,
  readHandoff,
} from "./handoff";

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("challengeMatches", () => {
  it("accepts the verifier the challenge was made from (RFC 7636's example)", () => {
    expect(challengeMatches(CHALLENGE, VERIFIER)).toBe(true);
  });

  it("refuses any other verifier, and anything malformed", () => {
    expect(challengeMatches(CHALLENGE, `${VERIFIER.slice(0, -1)}A`)).toBe(
      false,
    );
    expect(challengeMatches(CHALLENGE, "short")).toBe(false);
    expect(challengeMatches("not-a-challenge", VERIFIER)).toBe(false);
    expect(challengeMatches(CHALLENGE, `${VERIFIER}.extra`)).toBe(false);
  });
});

describe("readHandoff", () => {
  const token = newHandoffToken();

  it("reads the app's header", () => {
    expect(readHandoff(`${token}.${VERIFIER}`)).toEqual({
      token,
      verifier: VERIFIER,
    });
  });

  it("refuses anything else", () => {
    expect(readHandoff(null)).toBeNull();
    expect(readHandoff(token)).toBeNull();
    expect(readHandoff(`${token}.${VERIFIER}.more`)).toBeNull();
    expect(readHandoff(`${token}.has space`)).toBeNull();
  });
});

describe("tokens", () => {
  it("are long and random, and stored only as a hash", () => {
    const token = newHandoffToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newHandoffToken()).not.toBe(token);
    expect(handoffKey(token)).not.toContain(token);
    expect(handoffKey(token)).toBe(handoffKey(token));
  });
});

describe("a token's life", () => {
  it("outlasts the browser asking to open the app, and no more", () => {
    const now = Date.parse("2026-11-03T09:00:00Z");
    const expiresAt = handoffExpiresAt(now);
    // Someone reading "Open FaceOn?" for the first time: the token must still work.
    expect(handoffUsable(expiresAt, now + 2 * 60_000)).toBe(true);
    expect(handoffUsable(expiresAt, now + 9 * 60_000)).toBe(true);
    expect(handoffUsable(expiresAt, now + 11 * 60_000)).toBe(false);
  });
});
