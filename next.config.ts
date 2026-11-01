import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { NOINDEX_ROUTES } from "./src/lib/routes";

const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

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
