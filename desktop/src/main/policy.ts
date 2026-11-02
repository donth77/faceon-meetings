export type NavigationDecision = "allow" | "external" | "deny";

/**
 * Where the window may go: its own origin. Other https:// pages and mailto: links open
 * in the system's browser or mail app; every other scheme is refused.
 */
export function decideNavigation(
  target: string,
  appOrigin: string,
): NavigationDecision {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return "deny";
  }
  if (url.origin === appOrigin) return "allow";
  if (url.protocol === "https:" || url.protocol === "mailto:")
    return "external";
  return "deny";
}

/** What a meeting needs, and nothing else. */
const GRANTED = new Set([
  "media",
  "display-capture",
  "notifications",
  "fullscreen",
  "clipboard-sanitized-write",
]);

/**
 * Permissions go only to the app's own origin, and only those a meeting needs: camera
 * and microphone, screen capture, notifications, full screen and copying.
 */
export function decidePermission(
  permission: string,
  requestingOrigin: string | null | undefined,
  appOrigin: string,
  mediaTypes?: readonly string[],
): boolean {
  if (!requestingOrigin) return false;
  let origin: string;
  try {
    origin = new URL(requestingOrigin).origin;
  } catch {
    return false;
  }
  if (origin !== appOrigin || !GRANTED.has(permission)) return false;
  if (permission === "media" && mediaTypes) {
    return mediaTypes.every((type) => type === "audio" || type === "video");
  }
  return true;
}
