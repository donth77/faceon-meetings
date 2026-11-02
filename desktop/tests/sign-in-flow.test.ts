import { describe, expect, it } from "vitest";

import {
  challengeFor,
  newVerifier,
  PendingSignIns,
  SIGN_IN_TTL_MS,
} from "../src/main/sign-in-flow";

describe("challengeFor", () => {
  it("is S256, as in RFC 7636's example", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("makes long, URL-safe verifiers that differ each time", () => {
    const a = newVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newVerifier()).not.toBe(a);
  });
});

describe("PendingSignIns", () => {
  it("hands back the verifier that matches the challenge, once", () => {
    const pending = new PendingSignIns();
    const { state, challenge } = pending.start(0);
    const verifier = pending.take(state, 1000);
    expect(verifier).not.toBeNull();
    expect(challengeFor(verifier ?? "")).toBe(challenge);
    expect(pending.take(state, 2000)).toBeNull();
  });

  it("ignores states it never made, and ones too old", () => {
    const pending = new PendingSignIns();
    expect(pending.take("someone-elses-state", 0)).toBeNull();
    const { state } = pending.start(0);
    expect(pending.take(state, SIGN_IN_TTL_MS + 1)).toBeNull();
  });
});
