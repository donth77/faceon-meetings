import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return PUBLIC_ROUTES.map((path) => ({
    url: path === "/" ? origin : `${origin}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
