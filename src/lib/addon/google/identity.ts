import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Who Google says is asking: the Google account's ID, and its address if it shares one. */
export type GoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
};

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Google's signing keys, fetched when needed and cached by jose. */
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

/**
 * Checks the Google identity token the add-on sends (ScriptApp.getIdentityToken()):
 * Google's signature, the issuer, the audience (the add-on's own OAuth client, so a
 * token made for another app is refused) and the expiry. Null when any check fails.
 * The token is used for this one request: never stored, never logged.
 */
export async function verifyAddonToken(
  token: string,
  audience: string,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<GoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: ISSUERS,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    if (typeof payload.sub !== "string" || payload.sub === "") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}
