import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Who Google says is asking, and from which add-on: the Google account's ID, its
 * address if it shares one, and the OAuth client the token was made for (`aud`).
 */
export type GoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  audience: string;
};

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Google's signing keys, fetched when needed and cached by jose. */
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

/**
 * Checks the Google identity token an add-on sends (ScriptApp.getIdentityToken()):
 * Google's signature, the issuer and the expiry. Null when any check fails. Every
 * person's add-on is its own OAuth client, so the audience is checked by whoever reads
 * it (setup.ts, addonFor): it must be one of the copies FaceOn made, used by its owner,
 * so that a token Google made for any other app never works here. The token is used for
 * this one request: never stored, never logged.
 */
export async function verifyAddonToken(
  token: string,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<GoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: ISSUERS,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    if (typeof payload.sub !== "string" || payload.sub === "") return null;
    // One audience: Apps Script's tokens are made for the add-on's client alone.
    if (typeof payload.aud !== "string" || payload.aud === "") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.email_verified === true,
      audience: payload.aud,
    };
  } catch {
    return null;
  }
}
