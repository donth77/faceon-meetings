/** Settings → General: what the join page does about the desktop app. Default ask. */
export const DESKTOP_LINKS = ["ask", "always", "never"] as const;
export type DesktopLinks = (typeof DESKTOP_LINKS)[number];

/**
 * - none: inside the app already, on a phone or tablet, with Never, or rejoining
 * - suggest: this browser doesn't know the app is installed; a quiet offer, with the
 *   download, shown only where there's a release, and never opening it by itself
 * - ask: it knows, and the setting is Ask each time
 * - launch: it knows, and the setting is Always
 */
export type OpenInAppOffer = "none" | "suggest" | "ask" | "launch";

/**
 * What the join page does about the desktop app. Browsers can't tell whether it's
 * installed (https links reach it only from a store-signed app), so a browser opens it
 * by itself only once it knows the app is here (it signed the app in) and the person
 * chose Always. Ask is the default: joining in the browser is complete, and a launch
 * that fails, or a browser's own prompt, is worse than a choice.
 */
export function openInAppOffer(input: {
  inApp: boolean;
  computer: boolean;
  appKnown: boolean;
  setting: DesktopLinks;
  rejoin: boolean;
}): OpenInAppOffer {
  if (input.inApp || !input.computer || input.rejoin) return "none";
  if (input.setting === "never") return "none";
  if (!input.appKnown) return "suggest";
  return input.setting === "always" ? "launch" : "ask";
}

/**
 * The meeting's faceon:// link. The passcode stays after the #, as in the web link, so
 * it travels from this page to the app and never reaches a server.
 */
export const appMeetingLink = (code: string, passcode?: string | null) =>
  `faceon://j/${code}${passcode ? `#pwd=${encodeURIComponent(passcode)}` : ""}`;

/** A computer, not a phone or tablet (an iPad asking for desktop sites counts as a tablet). */
export function isComputer(userAgent: string, maxTouchPoints: number): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return false;
  return !(/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
