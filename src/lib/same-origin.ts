/**
 * Browsers always send Origin on cross-site requests that change things, so a mismatch
 * means another site is trying to act with the visitor's cookies. Non-browser clients
 * send no Origin. A page elsewhere can still load a GET (an image, say) without one, but
 * browsers mark every request with where it came from (Sec-Fetch-Site), so those are
 * turned away too.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return URL.canParse(origin) && new URL(origin).host === host;
}
