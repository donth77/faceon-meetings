import { defineRouting } from "next-intl/routing";

/**
 * UI languages, one message file each (messages/<locale>.json). URLs never carry a
 * locale: the proxy picks one from the NEXT_LOCALE cookie or the browser's Accept-Language
 * (regional variants match their base language, and anything unsupported falls back to
 * English), then rewrites to the internal [locale] segment.
 */
export const routing = defineRouting({
  locales: ["en", "es", "pt-BR", "fr", "de", "ja"],
  defaultLocale: "en",
  localePrefix: "never",
});
