/**
 * A value as written: a pair of quotes around it, as YAML wants for one that starts with
 * `{` (a title beginning with {appName}), isn't part of it.
 */
function unquote(value: string): string {
  const first = value[0];
  if (
    value.length >= 2 &&
    (first === '"' || first === "'") &&
    value.endsWith(first)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** A Markdown file's front matter (simple `key: value` lines) and its body. */
export function parseFrontMatter(raw: string): {
  fields: Map<string, string>;
  body: string;
} {
  const text = raw.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match?.[1]) return { fields: new Map(), body: text };
  const fields = new Map(
    match[1].split("\n").map((line) => {
      const colon = line.indexOf(":");
      return [
        line.slice(0, colon).trim(),
        unquote(line.slice(colon + 1).trim()),
      ] as const;
    }),
  );
  return { fields, body: text.slice(match[0].length) };
}
