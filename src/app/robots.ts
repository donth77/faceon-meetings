import type { MetadataRoute } from "next";

import { NOINDEX_ROUTES } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...NOINDEX_ROUTES],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
