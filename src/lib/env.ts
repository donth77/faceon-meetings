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
});

export const publicEnv = PublicEnv.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || undefined,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL || undefined,
  NEXT_PUBLIC_OPERATOR_NAME: process.env.NEXT_PUBLIC_OPERATOR_NAME || undefined,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL || undefined,
});
