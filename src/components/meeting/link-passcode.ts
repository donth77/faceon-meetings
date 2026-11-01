/**
 * Invite links carry the passcode in the URL fragment (#pwd=…), which browsers never send
 * to servers. The meeting page keeps it for this tab only (sessionStorage, so a reload or
 * a rejoin still has it) and removes it from the address bar right away.
 */
const KEY_PREFIX = "faceon.passcode.";

export function readLinkPasscode(code: string): string | undefined {
  const fromLink =
    new URLSearchParams(window.location.hash.slice(1)).get("pwd") ?? undefined;
  try {
    if (fromLink) sessionStorage.setItem(KEY_PREFIX + code, fromLink);
    return fromLink ?? sessionStorage.getItem(KEY_PREFIX + code) ?? undefined;
  } catch {
    return fromLink; // storage blocked
  }
}

/** Remembers a passcode that worked, for a rejoin from this tab. */
export function rememberPasscode(code: string, passcode: string): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + code, passcode);
  } catch {
    // storage blocked: the person types it again if they rejoin
  }
}

/** Takes the passcode out of the address bar, so screenshares and screenshots don't show it. */
export function scrubLinkPasscode(): void {
  if (!window.location.hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}
