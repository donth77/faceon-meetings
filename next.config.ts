import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { NOINDEX_ROUTES } from "./src/lib/routes";
import {
  contentSecurityPolicy,
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  cspMode,
} from "./src/lib/security/csp";

const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

/**
 * The Content Security Policy (src/lib/security/csp.ts) starts out report-only:
 * violations go to /api/csp-report and the server log, and nothing is blocked. Once
 * production's reports are quiet, CONTENT_SECURITY_POLICY=enforce makes it binding
 * ("off" leaves it out). Vercel sends Strict-Transport-Security itself.
 */
const CSP_MODE = cspMode(process.env.CONTENT_SECURITY_POLICY);

function policyHeaders() {
  if (CSP_MODE === "off") return [];
  const value = contentSecurityPolicy({
    mode: CSP_MODE,
    development: process.env.NODE_ENV === "development",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    turnstile: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  });
  return [
    {
      key:
        CSP_MODE === "enforce"
          ? "Content-Security-Policy"
          : "Content-Security-Policy-Report-Only",
      value,
    },
    {
      key: "Reporting-Endpoints",
      value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
    },
  ];
}

/**
 * On every response: no other site may frame FaceOn (so nobody can trick a click into
 * joining with the camera on); the camera, microphone, screen capture and full screen
 * are for FaceOn's own pages only; other sites get FaceOn's origin as the referrer, never
 * a page's address (a meeting link's ID stays here, and its passcode, after #, is never
 * sent anywhere); and windows FaceOn opens (Google's consent screen) stay apart from it
 * unless they come back to FaceOn.
 */
const SECURITY = [
  // Enforced even while the full policy only reports: report-only ignores frame-ancestors.
  ...(CSP_MODE === "enforce"
    ? []
    : [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }]),
  ...policyHeaders(),
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), geolocation=(), payment=(), usb=(), serial=(), hid=(), midi=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Memoizes components and values automatically, so a change redraws only what it
  // touches (the code is written for it: no hand-made memo or useCallback needed).
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  // Help articles and the legal pages are Markdown files read on the server.
  outputFileTracingIncludes: { "/**": ["./content/**/*.md"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY },
      // App, auth and meeting pages are never indexed.
      ...NOINDEX_ROUTES.flatMap((route) => [
        { source: route, headers: NOINDEX },
        { source: `${route}/:path*`, headers: NOINDEX },
      ]),
      // The service worker (public/sw.js): never from a cache, so an update reaches
      // everyone, and allowed to fetch from FaceOn itself only.
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

/**
 * With SENTRY_AUTH_TOKEN (and SENTRY_ORG and SENTRY_PROJECT; SENTRY_URL for GlitchTip or
 * a self-hosted Sentry), the build uploads source maps for error reports and then
 * deletes them, so they're never served. Without it, Sentry's build step isn't loaded.
 */
export default async function config(): Promise<NextConfig> {
  const base = withNextIntl(nextConfig);
  if (!process.env.SENTRY_AUTH_TOKEN) return base;
  const { withSentryConfig } = await import("@sentry/nextjs/config");
  return withSentryConfig(base, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    ...(process.env.SENTRY_URL ? { sentryUrl: process.env.SENTRY_URL } : {}),
    silent: !process.env.CI,
    telemetry: false,
    widenClientFileUpload: true,
    sourcemaps: { deleteSourcemapsAfterUpload: true },
    // Sentry starts in src/instrumentation*.ts, errors only: nothing wrapped at build.
    buildTimeInstrumentation: false,
    webpack: {
      autoInstrumentServerFunctions: false,
      autoInstrumentMiddleware: false,
      autoInstrumentAppDirectory: false,
    },
  });
}
