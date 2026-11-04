/**
 * Errors the browser catches that its error reports wouldn't see on their own: those from
 * before reports start (they load once the page is idle) and those an error page catches.
 * Until reports start they wait here, a few at most; then client.ts sends them, scrubbed
 * like every report. Nothing is kept without NEXT_PUBLIC_SENTRY_DSN.
 */

const MAX_WAITING = 10;

const waiting: unknown[] = [];
let send: ((error: unknown) => void) | null = null;

/** Reports an error caught in the browser: now, or once error reports start. */
export function reportBrowserError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (send) send(error);
  else if (waiting.length < MAX_WAITING) waiting.push(error);
}

/** Error reports have started: what waited goes now, and everything after it at once. */
export function startSendingBrowserErrors(
  sender: (error: unknown) => void,
): void {
  send = sender;
  for (const error of waiting.splice(0)) sender(error);
}
