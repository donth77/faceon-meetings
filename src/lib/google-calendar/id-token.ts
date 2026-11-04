import { z } from "zod";

const Claims = z.object({ email: z.email().max(320) });

/**
 * The email in the Google ID token Better Auth kept for a linked Google account: which
 * Google account it is, for Settings to show. It's read, not trusted: Google gave the
 * token straight to FaceOn's server when the account was linked, and nothing grants
 * access by it. Null when there's no token or it has no email.
 */
export function idTokenEmail(
  idToken: string | null | undefined,
): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload || payload.length > 8192) return null;
  try {
    const parsed = Claims.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data.email : null;
  } catch {
    return null;
  }
}
