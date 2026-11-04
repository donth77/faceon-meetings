/**
 * FaceOn's Content Security Policy: where its pages may load scripts, styles, images and
 * media from, connect to and frame. Everything listed is something the app uses; anything
 * else is reported to /api/csp-report. next.config.ts sends it on every page.
 *
 * Scripts allow 'unsafe-inline' rather than a nonce. With cacheComponents, pages are
 * partly prerendered into static shells served to everyone, and a per-request nonce can't
 * reach a shell's inline scripts (Next.js's CSP guide: nonces need every page rendered on
 * request, and Partial Prerendering is incompatible with them). The rest of the policy
 * still decides where code may come from and where data may go.
 *
 * Kept free of imports so next.config.ts can load it.
 */

/** Report-only to start (violations reported, nothing blocked), enforced once quiet. */
export type CspMode = "report-only" | "enforce" | "off";

/** Where violations are reported, for report-uri and the Reporting API's report-to. */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp";

/**
 * Stream, the media provider: its API and WebSocket, and the call servers (SFUs), whose
 * addresses its API hands out per call. TURN relays aren't fetches, so CSP doesn't apply.
 */
export const STREAM_SOURCES = [
  "https://video.stream-io-api.com",
  "wss://video.stream-io-api.com",
  "https://*.stream-io-video.com",
  "wss://*.stream-io-video.com",
] as const;

/**
 * The AI providers a host's browser calls with their own key for AI notes
 * (lib/notes/providers.ts; a unit test checks every one of its requests is covered).
 */
export const AI_PROVIDER_SOURCES = [
  "https://api.openai.com",
  "https://api.anthropic.com",
  "https://generativelanguage.googleapis.com",
  "https://api.deepseek.com",
  "https://openrouter.ai",
] as const;

/** Profile photos from Google and GitHub sign-in. */
export const PHOTO_SOURCES = [
  "https://*.googleusercontent.com",
  "https://avatars.githubusercontent.com",
] as const;

/** Cloudflare Turnstile's script and its challenge frame. */
export const TURNSTILE_SOURCE = "https://challenges.cloudflare.com";

export type CspOptions = {
  mode: Exclude<CspMode, "off">;
  /** next dev: React's error overlay needs eval. */
  development: boolean;
  /** Error reports go here (NEXT_PUBLIC_SENTRY_DSN), when they're on. */
  sentryDsn?: string | undefined;
  /** Turnstile is on (NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  turnstile: boolean;
};

/** The origin a Sentry (or GlitchTip) DSN sends reports to, if it's a valid one. */
export function dsnOrigin(dsn: string | undefined): string | null {
  if (!dsn || !URL.canParse(dsn)) return null;
  const url = new URL(dsn);
  return url.protocol === "https:" || url.protocol === "http:"
    ? url.origin
    : null;
}

/**
 * The policy's directives, in order. 'self' also covers Vercel Web Analytics, where it's
 * on: its script and page views stay on the site (/_vercel/insights).
 */
export function cspDirectives(options: CspOptions): Array<[string, string[]]> {
  const turnstile = options.turnstile ? [TURNSTILE_SOURCE] : [];
  const reports = dsnOrigin(options.sentryDsn);
  return [
    ["default-src", ["'self'"]],
    [
      "script-src",
      [
        "'self'",
        "'unsafe-inline'",
        // MediaPipe (backgrounds) and RNNoise (noise suppression) are WebAssembly.
        "'wasm-unsafe-eval'",
        ...(options.development ? ["'unsafe-eval'"] : []),
        ...turnstile,
      ],
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Backgrounds people add and downloads are blob: URLs; small icons are data: URLs.
    ["img-src", ["'self'", "data:", "blob:", ...PHOTO_SOURCES]],
    ["font-src", ["'self'", "data:"]],
    // Moving backgrounds and sounds; backgrounds people add are blob: URLs.
    ["media-src", ["'self'", "data:", "blob:"]],
    [
      "connect-src",
      [
        "'self'",
        ...STREAM_SOURCES,
        ...AI_PROVIDER_SOURCES,
        ...(reports ? [reports] : []),
      ],
    ],
    // Stream's timer runs in a worker made from a blob: URL; the service worker and the
    // backgrounds' timer are files here.
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", turnstile.length > 0 ? turnstile : ["'none'"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    // Ignored in a report-only policy (an enforced frame-ancestors is always sent).
    ...(options.mode === "enforce"
      ? ([
          ["frame-ancestors", ["'none'"]],
          ["upgrade-insecure-requests", []],
        ] satisfies Array<[string, string[]]>)
      : []),
    ["report-uri", [CSP_REPORT_PATH]],
    ["report-to", [CSP_REPORT_GROUP]],
  ];
}

/** The policy as a header value. */
export function contentSecurityPolicy(options: CspOptions): string {
  return cspDirectives(options)
    .map(([name, sources]) => [name, ...sources].join(" "))
    .join("; ");
}

/** CONTENT_SECURITY_POLICY: report-only unless set to enforce, or off. */
export function cspMode(value: string | undefined): CspMode {
  return value === "enforce" || value === "off" ? value : "report-only";
}
