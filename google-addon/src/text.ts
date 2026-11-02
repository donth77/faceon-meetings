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

/** "en-GB" → "en"; "pt-BR" stays "pt-BR" when there's a file for it. */
export function languageOf(
  locale: string | undefined,
  available: readonly string[],
): string {
  const wanted = (locale ?? "").replace("_", "-");
  if (available.includes(wanted)) return wanted;
  const base = wanted.split("-")[0] ?? "";
  if (available.includes(base)) return base;
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
