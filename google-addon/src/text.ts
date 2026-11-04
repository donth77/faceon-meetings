/**
 * Card text, from messages/<language>.json's GoogleAddon section, picked by the
 * person's language in Google (English when FaceOn has no messages for it). Values go
 * in by name: "Join {title}". The build bundles every language's text.
 */
export type Texts = Record<string, Record<string, unknown>>;
export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * The file for a person's language: the same tag, or else one in the same language, so
 * every regional variant uses its language ("en-GB" → "en", "pt-PT" → "pt-BR").
 */
export function languageOf(
  locale: string | undefined,
  available: readonly string[],
): string {
  const wanted = (locale ?? "").replace("_", "-").toLowerCase();
  const exact = available.find((file) => file.toLowerCase() === wanted);
  if (exact) return exact;
  const base = wanted.split("-")[0];
  const sameLanguage = available.find(
    (file) => file.split("-")[0]?.toLowerCase() === base,
  );
  if (sameLanguage) return sameLanguage;
  return available.includes("en") ? "en" : (available[0] ?? "en");
}

/** Replaces {name} with each value; unknown names stay as they are. */
export function format(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

function lookup(
  tree: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** A translator for one person: their language first, then English, then the key itself. */
export function translator(
  texts: Texts,
  locale: string | undefined,
  appName: string,
): Translate {
  const language = languageOf(locale, Object.keys(texts));
  return (key, values = {}) => {
    const template =
      lookup(texts[language], key) ?? lookup(texts.en, key) ?? key;
    return format(template, { appName, ...values });
  };
}
