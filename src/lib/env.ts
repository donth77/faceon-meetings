import { z } from "zod";

/**
 * Public settings, safe to send to the browser. Each value is read with a literal
 * `process.env.NEXT_PUBLIC_*` expression so Next.js can inline it at build time.
 * Empty strings count as unset.
 */
const PublicEnv = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("FaceOn"),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
  NEXT_PUBLIC_REPO_URL: z.url().optional(),
  /** Who runs this copy, as the privacy policy and terms name them. */
  NEXT_PUBLIC_OPERATOR_NAME: z.string().min(1).optional(),
  /** Where people write about privacy or the terms. */
  NEXT_PUBLIC_CONTACT_EMAIL: z.email().optional(),
  /** Whose laws govern the terms, like "the State of New York, USA". */
  NEXT_PUBLIC_OPERATOR_JURISDICTION: z.string().min(1).optional(),
  /** AI notes, on unless this copy turns them off. */
  NEXT_PUBLIC_AI_NOTES: z.enum(["on", "off"]).default("on"),
  /** Cloudflare Turnstile's site key: with TURNSTILE_SECRET_KEY, checks for a person. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  /** Where error reports go (Sentry, or GlitchTip); none without it. */
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
});

export const publicEnv = PublicEnv.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || undefined,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || undefined,
  NEXT_PUBLIC_OPERATOR_NAME: process.env.NEXT_PUBLIC_OPERATOR_NAME || undefined,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined,
  NEXT_PUBLIC_OPERATOR_JURISDICTION:
    process.env.NEXT_PUBLIC_OPERATOR_JURISDICTION || undefined,
  NEXT_PUBLIC_AI_NOTES: process.env.NEXT_PUBLIC_AI_NOTES || undefined,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY:
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
});

/** Whether this copy offers AI notes. */
export const aiNotesEnabled = publicEnv.NEXT_PUBLIC_AI_NOTES === "on";
