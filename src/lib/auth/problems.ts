/** What a failed sign-in, sign-up or password call means for the person. */
export type AuthProblem =
  | "wrongCredentials"
  | "notVerified"
  | "tooMany"
  | "passwordShort"
  | "passwordBreached"
  | "invalidEmail"
  | "invalidToken"
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
    default:
      return error.status === 401 ? "wrongCredentials" : "generic";
  }
}
