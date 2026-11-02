import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { verifyAddonToken } from "./identity";

const AUDIENCE = "123-addon.apps.googleusercontent.com";
let keys: JWTVerifyGetKey;
let googleKey: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const google = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  googleKey = google.privateKey;
  otherKey = other.privateKey;
  const jwk = {
    ...(await exportJWK(google.publicKey)),
    kid: "g1",
    alg: "RS256",
  };
  keys = createLocalJWKSet({ keys: [jwk] });
});

function token(
  claims: Record<string, unknown>,
  {
    key = googleKey,
    issuer = "https://accounts.google.com",
    audience = AUDIENCE,
    expires = "5m",
  }: {
    key?: CryptoKey;
    issuer?: string;
    audience?: string;
    expires?: string;
  } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "g1" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);
}

describe("verifyAddonToken", () => {
  it("accepts Google's token for this add-on, with who it's for", async () => {
    const valid = await token({
      sub: "1077",
      email: "ada@example.com",
      email_verified: true,
    });
    expect(await verifyAddonToken(valid, AUDIENCE, keys)).toEqual({
      sub: "1077",
      email: "ada@example.com",
      emailVerified: true,
    });
    const bare = await token(
      { sub: "1077" },
      { issuer: "accounts.google.com" },
    );
    expect(await verifyAddonToken(bare, AUDIENCE, keys)).toEqual({
      sub: "1077",
      email: null,
      emailVerified: false,
    });
  });

  it("refuses a token made for another app", async () => {
    const elsewhere = await token(
      { sub: "1077" },
      { audience: "another-client" },
    );
    expect(await verifyAddonToken(elsewhere, AUDIENCE, keys)).toBeNull();
  });

  it("refuses another issuer, a wrong signature and an expired token", async () => {
    const issuer = await token(
      { sub: "1077" },
      { issuer: "https://evil.example" },
    );
    const forged = await token({ sub: "1077" }, { key: otherKey });
    const expired = await token({ sub: "1077" }, { expires: "-2m" });
    for (const bad of [issuer, forged, expired, "not.a.token", ""]) {
      expect(await verifyAddonToken(bad, AUDIENCE, keys)).toBeNull();
    }
  });

  it("refuses a token without a subject", async () => {
    expect(await verifyAddonToken(await token({}), AUDIENCE, keys)).toBeNull();
  });
});
