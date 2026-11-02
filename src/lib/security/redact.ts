/**
 * Addresses and text made safe for logs and error reports: no query strings or
 * fragments (where a meeting's passcode travels, #pwd=…), and IDs in paths replaced
 * with what they stand for. Shared by the CSP report endpoint and error reports.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Path patterns whose IDs are replaced, most specific first. */
const PATH_IDS: ReadonlyArray<[RegExp, string]> = [
  [/\/j\/[^/]+/g, "/j/:code"],
  [/\/(api\/)?meetings\/[^/]+/g, "/$1meetings/:code"],
  [new RegExp(`/previous/${UUID}`, "gi"), "/previous/:session"],
  [new RegExp(`/notes/${UUID}`, "gi"), "/notes/:session"],
  [/\/admission\/[^/]+/g, "/admission/:request"],
  [/\/avatar\/[^/]+/g, "/avatar/:seed"],
  [new RegExp(UUID, "gi"), ":id"],
  // A meeting ID or other number long enough to be one.
  [/\d{6,}/g, ":n"],
];

/** A path with its IDs replaced: /j/1234567890 → /j/:code. */
export function redactPath(path: string): string {
  return PATH_IDS.reduce(
    (redacted, [pattern, replacement]) =>
      redacted.replace(pattern, replacement),
    path,
  );
}

/**
 * A URL without its query string or fragment, and with IDs in its path replaced. Same-site
 * addresses keep only the path; others keep their origin. Anything that isn't a URL is
 * left to redactText.
 */
export function redactUrl(value: string, base?: string): string {
  if (!URL.canParse(value, base)) {
    const [before = ""] = value.split(/[?#]/);
    return before.startsWith("/") ? redactPath(before) : redactText(before);
  }
  const url = new URL(value, base);
  if (url.protocol === "data:" || url.protocol === "blob:") return url.protocol;
  const path = redactPath(url.pathname);
  const sameSite =
    base !== undefined &&
    URL.canParse(base) &&
    new URL(base).origin === url.origin;
  return sameSite || !/^(https?|wss?):$/.test(url.protocol)
    ? path
    : `${url.origin}${path}`;
}

/** Everything that looks like a URL inside free text, redacted the same way. */
const URL_IN_TEXT = /\b(?:https?|wss?):\/\/[^\s"'<>)]+/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Provider keys as they're written (sk-…, sk-ant-…, AIza…, sk-or-…), and bearer tokens. */
const SECRET =
  /\b(?:sk-[\w-]{16,}|AIza[\w-]{30,}|ya29\.[\w.-]{20,}|Bearer\s+[\w.~+/-]{16,})/g;

/**
 * Free text (an error's message, say) without the things that identify someone or
 * unlock something: email addresses, keys and tokens, URLs' queries and fragments, and
 * long numbers such as meeting IDs.
 */
export function redactText(text: string): string {
  return text
    .replace(SECRET, "[secret]")
    .replace(URL_IN_TEXT, (url) => redactUrl(url))
    .replace(EMAIL, "[email]")
    .replace(/#pwd=[^\s&]*/g, "")
    .replace(/\b\d{6,}\b/g, ":n");
}
