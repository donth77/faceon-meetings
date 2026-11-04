import { describe, expect, it } from "vitest";

import { idTokenEmail, withoutIdToken } from "./id-token";

/** An ID token's shape: header, claims and signature, each base64url. */
const token = (claims: unknown) =>
  [
    Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");

describe("the email in a Google ID token", () => {
  it("reads the account's email", () => {
    expect(
      idTokenEmail(
        token({ sub: "1", email: "tom@gmail.com", email_verified: true }),
      ),
    ).toBe("tom@gmail.com");
  });

  it("is null without a token, an email, or a readable one", () => {
    expect(idTokenEmail(null)).toBeNull();
    expect(idTokenEmail(undefined)).toBeNull();
    expect(idTokenEmail(token({ sub: "1" }))).toBeNull();
    expect(idTokenEmail(token({ email: "not an email" }))).toBeNull();
    expect(idTokenEmail("not-a-token")).toBeNull();
    expect(idTokenEmail("a.%%%.c")).toBeNull();
  });
});

describe("what an account keeps of an ID token", () => {
  it("keeps the email and never the token", () => {
    expect(
      withoutIdToken({ idToken: token({ sub: "1", email: "tom@gmail.com" }) }),
    ).toEqual({ data: { idToken: null, providerEmail: "tom@gmail.com" } });
  });

  it("drops a token without an email, keeping the email it had", () => {
    expect(withoutIdToken({ idToken: token({ sub: "1" }) })).toEqual({
      data: { idToken: null },
    });
    expect(withoutIdToken({ idToken: "not-a-token" })).toEqual({
      data: { idToken: null },
    });
  });

  it("changes nothing when no token comes", () => {
    expect(withoutIdToken({})).toBeUndefined();
    expect(withoutIdToken({ idToken: null })).toBeUndefined();
    expect(withoutIdToken({ idToken: "" })).toBeUndefined();
  });
});
