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

const EmailList = z.string().transform((value) =>
  value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

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
  /**
   * The desktop app's public releases repository, as owner/name: /download and "Get the
   * desktop app" read its latest release (lib/desktop/releases.ts). Empty: no desktop app.
   */
  DESKTOP_RELEASES_REPO: z
    .string()
    .regex(/^([\w.-]+\/[\w.-]+)?$/)
    .optional(),
  /**
   * The desktop builds that are signed (Windows) or notarized (Mac), comma-separated:
   * "windows", "mac" or both. /download explains how to open the others the first time.
   */
  DESKTOP_SIGNED: z
    .string()
    .regex(/^((windows|mac)(,(windows|mac))*)?$/)
    .optional(),
  /**
   * Authorizes the schedulers (sent as "Authorization: Bearer <secret>"): the daily sweep,
   * and meeting reminder emails every few minutes.
   */
  CRON_SECRET: z.string().optional(),
  /**
   * How many reminder emails a day at most, so account emails always fit within Resend's
   * free plan (100 a day). Reminders past it wait, and are dropped once the meeting starts.
   */
  REMINDER_EMAILS_PER_DAY: z.coerce.number().int().min(0).default(50),
  /** Cloudflare Turnstile's secret key, with NEXT_PUBLIC_TURNSTILE_SITE_KEY (lib/human-check). */
  TURNSTILE_SECRET_KEY: z.string().optional(),
  /** Other hostnames whose Turnstile tokens a guest join accepts, comma-separated. */
  TURNSTILE_HOSTNAMES: z.string().optional(),
  /** Resend, for account emails (verify your address, reset your password). */
  RESEND_API_KEY: z.string().optional(),
  /** The sender, e.g. "FaceOn <no-reply@mail.example.com>", on a domain verified in Resend. */
  EMAIL_FROM: z.string().optional(),
  /**
   * The Google Workspace add-on's OAuth client ID: the `aud` of the identity tokens it
   * sends. Unset, the add-on's API (/api/addon/google/*) is off.
   */
  GOOGLE_ADDON_CLIENT_ID: z.string().min(1).optional(),
  /** Google Calendar sync for hosts who connect it ("on" or "off"); off leaves the calendar links. */
  GOOGLE_CALENDAR_SYNC: z.enum(["on", "off"]).default("on"),
  /**
   * Wake a sleeping database as someone shows intent: "auto" (the default) for Neon only,
   * "on" or "off" (lib/db/wake-rule.ts).
   */
  DATABASE_WAKE_ON_INTENT: z.enum(["auto", "on", "off"]).default("auto"),
  MAX_PARTICIPANTS_PER_MEETING: z.coerce.number().int().min(2).default(20),
  /** 0 means no time limit. */
  MAX_MEETING_MINUTES: z.coerce.number().int().min(0).default(0),
  /** Live meetings at once, across everyone; keeps usage inside the free tier. */
  MAX_CONCURRENT_MEETINGS: z.coerce.number().int().min(1).default(10),
  /** Comma-separated emails: admins, who also host with full limits. */
  ADMIN_EMAILS: EmailList.default([]),
  /** Comma-separated emails that host with full limits; everyone else hosts demos. */
  HOST_ALLOWLIST: EmailList.default([]),
  DEMO_MAX_MINUTES: z.coerce.number().int().min(1).default(15),
  DEMO_MAX_PARTICIPANTS: z.coerce.number().int().min(2).default(4),
  DEMO_MEETINGS_PER_DAY: z.coerce.number().int().min(0).default(3),
  /** Ask "Are you still there?" after this long alone in a meeting; 0 turns it off. */
  ALONE_TIMEOUT_MINUTES: z.coerce.number().int().min(0).default(10),
  /** Meetings one account may create in a day; stops bots from burning the free credit. */
  MEETINGS_PER_USER_PER_DAY: z.coerce.number().int().min(1).default(20),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

let parsed: ServerEnv | undefined;

const read = () =>
  ServerEnv.parse(
    Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== ""),
    ),
  );

/** Parsed once in production; on every call in development, so edits apply at once. */
export function serverEnv(): ServerEnv {
  if (process.env.NODE_ENV !== "production") return read();
  parsed ??= read();
  return parsed;
}
