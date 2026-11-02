/**
 * Browsers always send Origin on cross-site requests that change things, so a mismatch
 * means another site is trying to act with the visitor's cookies. Non-browser clients
 * send no Origin.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return URL.canParse(origin) && new URL(origin).host === host;
}
