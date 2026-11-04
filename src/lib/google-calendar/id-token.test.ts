import { describe, expect, it } from "vitest";

import { idTokenEmail } from "./id-token";

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
