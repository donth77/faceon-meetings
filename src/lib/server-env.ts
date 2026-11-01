import "server-only";

import { z } from "zod";

const Providers = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(["stream", "livekit"])).min(1));

/**
 * Server-only settings. Parsed on first use rather than at import, so pages that never
 * need them build and run without them. Empty strings count as unset.
 */
const ServerEnv = z.object({
  /** Media providers in priority order. */
  MEDIA_PROVIDERS: Providers.default(["stream"]),
  NEXT_PUBLIC_STREAM_API_KEY: z.string().optional(),
  STREAM_API_SECRET: z.string().optional(),
  STREAM_SYSTEM_USER_ID: z.string().default("system"),
  /** Signs auth cookies; also keys the hashes of rate-limited IP addresses. */
  BETTER_AUTH_SECRET: z.string().optional(),
  /** Signs the guest cookie (a random guest ID and avatar; no personal data). */
  GUEST_SESSION_SECRET: z.string().optional(),
  /** Whether people without an account may join meetings (hosts can still say no). */
  ALLOW_GUESTS: z.stringbool().default(true),
  /** Resend, for account emails (verify your address, reset your password). */
  RESEND_API_KEY: z.string().optional(),
  /** The sender, e.g. "FaceOn <no-reply@mail.example.com>", on a domain verified in Resend. */
  EMAIL_FROM: z.string().optional(),
  MAX_PARTICIPANTS_PER_MEETING: z.coerce.number().int().min(2).default(20),
  /** 0 means no time limit. */
  MAX_MEETING_MINUTES: z.coerce.number().int().min(0).default(0),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let parsed: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  parsed ??= ServerEnv.parse(
    Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== ""),
    ),
  );
  return parsed;
}
