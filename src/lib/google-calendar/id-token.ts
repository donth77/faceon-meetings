import { z } from "@/lib/zod";

const Claims = z.object({ email: z.email().max(320) });

/**
 * The email in a Google ID token: which Google account it is, for Settings to show. It's
 * read, not trusted: Google gave the token straight to FaceOn's server, and nothing grants
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

/**
 * What an account keeps of the ID token a provider sends (Better Auth's account hooks):
 * only the email in it, as `providerEmail`, never the token. Nothing for an account
 * write without one, so a token refresh that brings none keeps the email it has.
 */
export function withoutIdToken(account: {
  idToken?: string | null;
}): { data: { idToken: null; providerEmail?: string } } | undefined {
  if (!account.idToken) return undefined;
  const email = idTokenEmail(account.idToken);
  return {
    data: { idToken: null, ...(email ? { providerEmail: email } : {}) },
  };
}
