/** Meeting IDs are ten digits, never starting with 0 (src/lib/meetings/codes.ts). */
const MEETING_CODE = /^[1-9]\d{9}$/;
const PASSCODE = /^[A-Za-z0-9@_*-]{1,32}$/;
const STATE = /^[A-Za-z0-9_-]{16,128}$/;
const TOKEN = /^[A-Za-z0-9_-]{20,256}$/;
/** Pages a link may open by name, e.g. faceon://upcoming. */
const PAGES = new Set(["home", "upcoming", "previous", "schedule", "settings"]);

export type AppLink =
  | { kind: "open"; path: string }
  | { kind: "auth"; state: string; token: string };

/**
 * What a faceon:// link asks for: a meeting (faceon://j/<id>#pwd=…), the hand-back from
 * signing in through the browser (faceon://auth?state=…&token=…), a page by name, or
 * Home (faceon:// alone). Anything else is ignored, so a link can't take the window
 * anywhere it shouldn't.
 */
export function parseAppLink(raw: string): AppLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "faceon:") return null;
  // faceon://j/123 has the host "j"; faceon:j/123 has none. Both mean the same.
  const parts = [url.host, ...url.pathname.split("/")].filter(Boolean);
  const [first, second, ...rest] = parts;
  if (!first) return { kind: "open", path: "/home" };
  if (rest.length > 0) return null;
  if (first === "j") {
    if (!second || !MEETING_CODE.test(second)) return null;
    const pwd = new URLSearchParams(url.hash.slice(1)).get("pwd");
    const fragment =
      pwd && PASSCODE.test(pwd) ? `#pwd=${encodeURIComponent(pwd)}` : "";
    return { kind: "open", path: `/j/${second}${fragment}` };
  }
  if (second) return null;
  if (first === "auth") {
    const state = url.searchParams.get("state") ?? "";
    const token = url.searchParams.get("token") ?? "";
    return STATE.test(state) && TOKEN.test(token)
      ? { kind: "auth", state, token }
      : null;
  }
  return PAGES.has(first) ? { kind: "open", path: `/${first}` } : null;
}

/** The faceon:// link among a launch's arguments (Windows passes it there). */
export function linkInArgv(argv: readonly string[]): string | undefined {
  return argv.find((arg) => arg.toLowerCase().startsWith("faceon:"));
}
