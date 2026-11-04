/**
 * Public settings, safe to send to the browser. Each value is read with a literal
 * `process.env.NEXT_PUBLIC_*` expression so Next.js can inline it at build time.
 * Empty strings count as unset. Checked with plain code rather than a schema library,
 * because every page loads this: a bad value still stops the app where it's first read.
 */

const read = (value: string | undefined) => value || undefined;

function url(name: string, value: string | undefined) {
  if (value === undefined) return value;
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a URL.`);
  }
  return value;
}

function email(name: string, value: string | undefined) {
  if (value !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${name} must be an email address.`);
  }
  return value;
}

function choice<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  const found = allowed.find((option) => option === value);
  if (!found) throw new Error(`${name} must be ${allowed.join(" or ")}.`);
  return found;
}

export const publicEnv = {
  NEXT_PUBLIC_APP_NAME: read(process.env.NEXT_PUBLIC_APP_NAME) ?? "FaceOn",
  NEXT_PUBLIC_APP_URL: url(
    "NEXT_PUBLIC_APP_URL",
    read(process.env.NEXT_PUBLIC_APP_URL),
  ),
  NEXT_PUBLIC_REPO_URL: url(
    "NEXT_PUBLIC_REPO_URL",
    read(process.env.NEXT_PUBLIC_REPO_URL),
  ),
  /** Who runs this copy, as the privacy policy and terms name them. */
  NEXT_PUBLIC_OPERATOR_NAME: read(process.env.NEXT_PUBLIC_OPERATOR_NAME),
  /** Where people write about privacy or the terms. */
  NEXT_PUBLIC_CONTACT_EMAIL: email(
    "NEXT_PUBLIC_CONTACT_EMAIL",
    read(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  ),
  /** Whose laws govern the terms, like "the State of New York, USA". */
  NEXT_PUBLIC_OPERATOR_JURISDICTION: read(
    process.env.NEXT_PUBLIC_OPERATOR_JURISDICTION,
  ),
  /** AI notes, on unless this copy turns them off. */
  NEXT_PUBLIC_AI_NOTES: choice(
    "NEXT_PUBLIC_AI_NOTES",
    read(process.env.NEXT_PUBLIC_AI_NOTES),
    ["on", "off"] as const,
    "on",
  ),
  /** Cloudflare Turnstile's site key: with TURNSTILE_SECRET_KEY, checks for a person. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: read(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  ),
  /** Where error reports go (Sentry, or GlitchTip); none without it. */
  NEXT_PUBLIC_SENTRY_DSN: url(
    "NEXT_PUBLIC_SENTRY_DSN",
    read(process.env.NEXT_PUBLIC_SENTRY_DSN),
  ),
  /**
   * "1" counts page views with Vercel Web Analytics. Only for a copy on Vercel with Web
   * Analytics on for the project: /_vercel/insights exists nowhere else.
   */
  NEXT_PUBLIC_VERCEL_ANALYTICS: choice(
    "NEXT_PUBLIC_VERCEL_ANALYTICS",
    read(process.env.NEXT_PUBLIC_VERCEL_ANALYTICS),
    ["1", "0"] as const,
    "0",
  ),
};

/** Whether this copy offers AI notes. */
export const aiNotesEnabled = publicEnv.NEXT_PUBLIC_AI_NOTES === "on";

/**
 * Whether pages count their views with Vercel Web Analytics: where this copy turns it on,
 * in production builds (`next dev` has no /_vercel/insights).
 */
export const vercelAnalyticsEnabled =
  publicEnv.NEXT_PUBLIC_VERCEL_ANALYTICS === "1" &&
  process.env.NODE_ENV === "production";
