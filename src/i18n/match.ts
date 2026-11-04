/** next-intl reads the chosen language from this cookie (URLs never carry one). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** How long a chosen language is remembered on a device. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The browser's languages from an Accept-Language header, most wanted first. */
export function preferredLanguages(
  header: string | null | undefined,
): string[] {
  return (header ?? "")
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const quality = q === undefined ? 1 : Number(q.slice(2));
      return {
        tag: tag.trim(),
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter(({ tag, quality }) => tag !== "" && tag !== "*" && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ tag }) => tag);
}

/**
 * The language a language tag asks for, among `locales`: the same tag, or else one in
 * the same base language, so every regional variant counts as its language ("es-MX" is
 * Spanish, "pt-PT" and "pt-AO" are Portuguese (Brazil), "en-GB" is English).
 */
export function supportedLocale<L extends string>(
  tag: string | null | undefined,
  locales: readonly L[],
): L | undefined {
  if (!tag) return undefined;
  const wanted = tag.replace("_", "-").toLowerCase();
  const exact = locales.find((locale) => locale.toLowerCase() === wanted);
  if (exact) return exact;
  const base = wanted.split("-")[0];
  return locales.find((locale) => locale.split("-")[0]?.toLowerCase() === base);
}

/**
 * The language to show a visitor from their browser's Accept-Language list: the first
 * one they prefer that FaceOn speaks. Languages it doesn't speak are skipped, so a
 * Swedish visitor who also lists German gets German; with no match, `fallback`.
 */
export function matchLocale<L extends string>(
  acceptLanguage: string | null | undefined,
  locales: readonly L[],
  fallback: L,
): L {
  for (const tag of preferredLanguages(acceptLanguage)) {
    const locale = supportedLocale(tag, locales);
    if (locale) return locale;
  }
  return fallback;
}
