import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

/**
 * The web app manifest (/manifest.webmanifest), which installing FaceOn as an app reads:
 * its name, icons and colors (the brand's: the icon's white, then the app's page color
 * while it opens), and where it opens. Browsers fetch it without a language, so it's in
 * the default one.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Pwa" });
  const metadata = await getTranslations({ locale, namespace: "Metadata" });
  const nav = await getTranslations({ locale, namespace: "Nav" });
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  const shortcut = (label: string, url: string) => ({
    name: label,
    url,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  });

  return {
    id: "/home",
    name,
    short_name: name,
    description: metadata("description"),
    lang: locale,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    theme_color: "#ffffff",
    background_color: "#f5f6f8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      shortcut(t("shortcuts.schedule"), "/schedule"),
      shortcut(nav("upcoming"), "/upcoming"),
      shortcut(nav("personalRoom"), "/personal-room"),
    ],
    // A FaceOn link opened elsewhere goes to the app's window if it's open.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    categories: ["business", "productivity"],
  };
}
