/** What a failed sign-in, sign-up or password call means for the person. */
export type AuthProblem =
  | "wrongCredentials"
  | "notVerified"
  | "tooMany"
  | "passwordShort"
  | "passwordBreached"
  | "invalidEmail"
  | "invalidToken"
  /** The check for a person (Cloudflare Turnstile) didn't pass. */
  | "humanCheck"
  | "generic";

/** Maps a Better Auth error (HTTP status and code) to the message we show. */
export function authProblem(error: {
  status: number;
  code?: string | undefined;
}): AuthProblem {
  if (error.status === 429) return "tooMany";
  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return "notVerified";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "wrongCredentials";
    case "PASSWORD_TOO_SHORT":
      return "passwordShort";
    case "PASSWORD_COMPROMISED":
      return "passwordBreached";
    case "INVALID_EMAIL":
      return "invalidEmail";
    case "INVALID_TOKEN":
      return "invalidToken";
    case "VERIFICATION_FAILED":
    case "MISSING_RESPONSE":
      return "humanCheck";
    default:
      return error.status === 401 ? "wrongCredentials" : "generic";
  }
}

/**
 * Why connecting Google or GitHub to an account failed, from the error it came back
 * with ("email_does_not_match"; older Better Auth said "email_doesn't_match").
 */
export function linkProblem(
  error: string,
): "emailMismatch" | "alreadyLinked" | "generic" {
  if (error.startsWith("email_does")) return "emailMismatch";
  if (error === "account_already_linked_to_different_user")
    return "alreadyLinked";
  return "generic";
}
