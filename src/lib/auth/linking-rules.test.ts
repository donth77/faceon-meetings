import { describe, expect, it } from "vitest";

import {
  ACCOUNT_LINKING,
  decideLink,
  FRESH_SIGN_IN_MS,
  isFreshSignIn,
  linkIntentToken,
  readLinkIntent,
  sameAddress,
  type LinkAttempt,
  type LinkFacts,
} from "./linking-rules";

const SECRET = "test-secret";
const now = new Date("2026-11-04T12:00:00Z");
const minutes = (n: number) => n * 60_000;

const intent = (
  overrides: Partial<Parameters<typeof linkIntentToken>[0]> = {},
) =>
  linkIntentToken({
    userId: "user-1",
    sessionId: "session-1",
    now,
    secret: SECRET,
    ...overrides,
  });
const expected = {
  userId: "user-1",
  sessionId: "session-1",
  now,
  secret: SECRET,
};

describe("Better Auth's linking settings", () => {
  it("trusts no provider by name, so linking at sign-in needs the provider's verified email", () => {
    expect(ACCOUNT_LINKING).not.toHaveProperty("trustedProviders");
    expect(ACCOUNT_LINKING.enabled).toBe(true);
  });

  it("leaves the email rule to decideLink", () => {
    expect(ACCOUNT_LINKING.allowDifferentEmails).toBe(true);
  });
});

describe("a fresh sign-in", () => {
  it("is one from the last ten minutes", () => {
    expect(isFreshSignIn(new Date(now.getTime() - minutes(9)), now)).toBe(true);
    expect(isFreshSignIn(new Date(now.getTime() - FRESH_SIGN_IN_MS), now)).toBe(
      true,
    );
    expect(isFreshSignIn(new Date(now.getTime() - minutes(11)), now)).toBe(
      false,
    );
  });

  it("allows a little clock skew, not a sign-in from the future", () => {
    expect(isFreshSignIn(new Date(now.getTime() + 30_000), now)).toBe(true);
    expect(isFreshSignIn(new Date(now.getTime() + minutes(5)), now)).toBe(
      false,
    );
  });
});

describe("the go-ahead to connect a different email", () => {
  it("works for its own account and session, for ten minutes", () => {
    expect(readLinkIntent(intent(), expected)).toBe(true);
    expect(
      readLinkIntent(intent(), {
        ...expected,
        now: new Date(now.getTime() + minutes(10)),
      }),
    ).toBe(true);
    expect(
      readLinkIntent(intent(), {
        ...expected,
        now: new Date(now.getTime() + minutes(10) + 1),
      }),
    ).toBe(false);
  });

  it("doesn't work for another account or another session", () => {
    expect(readLinkIntent(intent(), { ...expected, userId: "user-2" })).toBe(
      false,
    );
    expect(
      readLinkIntent(intent(), { ...expected, sessionId: "session-2" }),
    ).toBe(false);
  });

  it("can't be forged or altered", () => {
    expect(readLinkIntent(intent({ secret: "other" }), expected)).toBe(false);
    const [payload, signature] = intent().split(".");
    const altered = Buffer.from(
      JSON.stringify({
        p: "link-any-email",
        u: "user-1",
        s: "session-1",
        e: 9e15,
      }),
    ).toString("base64url");
    expect(readLinkIntent(`${altered}.${signature}`, expected)).toBe(false);
    expect(readLinkIntent(`${payload}.`, expected)).toBe(false);
    expect(readLinkIntent(`${payload}.${signature}.x`, expected)).toBe(false);
    expect(readLinkIntent(undefined, expected)).toBe(false);
    expect(readLinkIntent(intent(), { ...expected, secret: "" })).toBe(false);
  });

  it("needs a secret to be made", () => {
    expect(() => intent({ secret: "" })).toThrow();
  });
});

describe("the same address", () => {
  it("ignores case and spaces around it", () => {
    expect(sameAddress(" Tom@Example.com", "tom@example.com ")).toBe(true);
    expect(sameAddress("tom@example.com", "thomas@example.com")).toBe(false);
    expect(sameAddress("", "")).toBe(false);
    expect(sameAddress(undefined, "tom@example.com")).toBe(false);
  });
});

describe("whether a provider account may be linked", () => {
  const ACCOUNT = "tom@example.com";
  const attempt = (overrides: Partial<LinkAttempt> = {}): LinkAttempt => ({
    action: "link-account",
    providerId: "google",
    providerEmail: ACCOUNT,
    providerEmailVerified: true,
    userId: "user-1",
    ...overrides,
  });
  const facts = (overrides: Partial<LinkFacts> = {}): LinkFacts => ({
    accountEmail: async (id) => (id === "user-1" ? ACCOUNT : null),
    session: async () => ({ userId: "user-1", sessionId: "session-1" }),
    intent: () => undefined,
    ...overrides,
  });
  const decide = (a: LinkAttempt, f: LinkFacts) =>
    decideLink(a, f, { now, secret: SECRET });

  it("leaves signing up and signing in alone", async () => {
    for (const action of ["create-user", "sign-in"]) {
      await expect(
        decide(attempt({ action, providerEmailVerified: false }), facts()),
      ).resolves.toBe("allow");
    }
  });

  it("links the same email, verified by the provider", async () => {
    await expect(
      decide(attempt({ providerEmail: "TOM@example.com" }), facts()),
    ).resolves.toBe("allow");
    await expect(
      decide(
        attempt({ providerId: "github", providerEmail: ACCOUNT }),
        facts(),
      ),
    ).resolves.toBe("allow");
  });

  it("never links an email the provider hasn't verified, even the same one", async () => {
    for (const providerEmailVerified of [false, undefined, "true"]) {
      await expect(
        decide(attempt({ providerEmailVerified }), facts()),
      ).resolves.toBe("email_not_verified");
    }
    await expect(
      decide(
        attempt({ providerEmailVerified: false }),
        facts({ intent: () => intent() }),
      ),
    ).resolves.toBe("email_not_verified");
  });

  it("refuses a different email without the go-ahead", async () => {
    await expect(
      decide(attempt({ providerEmail: "tom@gmail.com" }), facts()),
    ).resolves.toBe("email_does_not_match");
  });

  it("links a different Google email with the go-ahead from this session", async () => {
    await expect(
      decide(
        attempt({ providerEmail: "tom@gmail.com" }),
        facts({ intent: () => intent() }),
      ),
    ).resolves.toBe("allow");
  });

  it("refuses the go-ahead from another session, an expired one, or without a session", async () => {
    const different = attempt({ providerEmail: "tom@gmail.com" });
    await expect(
      decide(
        different,
        facts({ intent: () => intent({ sessionId: "session-2" }) }),
      ),
    ).resolves.toBe("email_does_not_match");
    await expect(
      decide(
        different,
        facts({
          intent: () => intent({ now: new Date(now.getTime() - minutes(11)) }),
        }),
      ),
    ).resolves.toBe("email_does_not_match");
    await expect(
      decide(
        different,
        facts({ intent: () => intent(), session: async () => null }),
      ),
    ).resolves.toBe("email_does_not_match");
    await expect(
      decide(
        different,
        facts({
          intent: () => intent(),
          session: async () => ({ userId: "user-2", sessionId: "session-1" }),
        }),
      ),
    ).resolves.toBe("email_does_not_match");
  });

  it("keeps GitHub to the same email, even with the go-ahead", async () => {
    await expect(
      decide(
        attempt({ providerId: "github", providerEmail: "tom@gmail.com" }),
        facts({ intent: () => intent() }),
      ),
    ).resolves.toBe("email_does_not_match");
  });

  it("refuses an account that isn't there", async () => {
    await expect(decide(attempt({ userId: "nobody" }), facts())).resolves.toBe(
      "unable_to_link_account",
    );
  });
});
