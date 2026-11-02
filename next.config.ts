import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { NOINDEX_ROUTES } from "./src/lib/routes";

const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

/**
 * On every response: no other site may frame FaceOn (so nobody can trick a click into
 * joining with the camera on), and the camera, microphone and screen capture are for
 * FaceOn's own pages only. A full Content Security Policy will add to this one.
 */
const SECURITY = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
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
      // Meeting links also send no referrer, so the link never leaks to other sites.
      {
        source: "/j/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
