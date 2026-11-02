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
        line.slice(colon + 1).trim(),
      ] as const;
    }),
  );
  return { fields, body: text.slice(match[0].length) };
}
