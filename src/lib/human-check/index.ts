/**
 * Proving there's a person behind a request that sends email or spends meeting minutes:
 * Cloudflare Turnstile in managed mode, where this copy has both of its keys
 * (NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY); without them there's no
 * check. The browser side is components/human-check. The server checks guest joins in
 * verify.ts, and account emails through Better Auth's captcha plugin (lib/auth/server.ts).
 * Email sign-in and Google or GitHub sign-in have no check: failed sign-ins are already
 * limited, and those providers screen for bots themselves.
 */

/** What a check is for. Cloudflare ties each token to one, and the server checks which. */
export type HumanCheckAction = "account" | "guest-join";

/**
 * Better Auth requests that send email, against the email service's daily allowance:
 * signing up, asking for a password reset, and asking for the verification email again.
 */
export const ACCOUNT_EMAIL_ENDPOINTS = [
  "/sign-up/email",
  "/request-password-reset",
  "/send-verification-email",
];

/** fetchOptions for a Better Auth call, carrying a check's token when there is one. */
export function humanCheckFetchOptions(token: string | undefined) {
  return token ? { headers: { "x-captcha-response": token } } : undefined;
}

/** A Better Auth error saying the check's token was missing or turned down. */
export function isHumanCheckError(
  error: { code?: string | undefined } | null | undefined,
): boolean {
  return (
    error?.code === "VERIFICATION_FAILED" || error?.code === "MISSING_RESPONSE"
  );
}
