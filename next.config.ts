import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// App and meeting pages are never indexed; meeting links also send no referrer.
const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
const PRIVATE_SOURCES = [
  "/join",
  "/sign-in",
  "/home",
  "/upcoming",
  "/previous",
  "/personal-room",
  "/schedule",
  "/meetings/:path*",
  "/settings",
  "/settings/:path*",
  "/admin",
  "/admin/:path*",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
      {
        source: "/j/:path*",
        headers: [...NOINDEX, { key: "Referrer-Policy", value: "no-referrer" }],
      },
      ...PRIVATE_SOURCES.map((source) => ({ source, headers: NOINDEX })),
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
