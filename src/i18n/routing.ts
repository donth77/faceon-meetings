import { defineRouting } from "next-intl/routing";

/**
 * UI languages. English only for now; each language is added here once its message file
 * exists. URLs never carry a locale: the proxy picks one from the NEXT_LOCALE cookie or the
 * browser's Accept-Language (regional variants match their base language, and anything
 * unsupported falls back to English), then rewrites to the internal [locale] segment.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "never",
});
