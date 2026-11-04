import { hasLocale, type Locale } from "next-intl";

import { LOCALE_COOKIE, matchLocale } from "./match";
import { routing } from "./routing";

/**
 * The language a request asks for, as the proxy picks it: the language chosen on this
 * device (its cookie), then the browser's languages, then English.
 */
export function localeOfRequest(headers: Headers | null | undefined): Locale {
  const chosen = headers
    ?.get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  if (hasLocale(routing.locales, chosen)) return chosen;
  return matchLocale(
    headers?.get("accept-language"),
    routing.locales,
    routing.defaultLocale,
  );
}
