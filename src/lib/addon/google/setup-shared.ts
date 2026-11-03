/**
 * Adding FaceOn to Google Calendar and Gmail, the parts the browser needs too: where
 * someone's own add-on stands, what can go wrong, and Google's pages. Safe to import in
 * the browser.
 */
import { linkProblem } from "@/lib/auth/problems";

/** Where someone's add-on stands (Settings → Calendar, and the desktop app, which asks). */
export type AddonSetup =
  /** This copy of FaceOn doesn't offer it. */
  | { status: "unavailable" }
  /** Not added. `granted`: Google already lets FaceOn add it, without asking again. */
  | { status: "none"; granted: boolean }
  /**
   * In their Google account: "created" until it's first used, then "connected".
   * `needsUpdate`: Google stopped FaceOn updating it, so FaceOn has to ask again.
   */
  | {
      status: "created" | "connected";
      scriptId: string;
      needsUpdate: boolean;
    };

/** Why adding or updating it didn't work. */
export type AddonProblem =
  /** Google didn't give FaceOn permission (declined, or the box unticked). */
  | "consent"
  /** The person's own Apps Script API setting is off. */
  | "userApiOff"
  /** This FaceOn's Google Cloud project doesn't have the Apps Script API on. */
  | "serviceDisabled"
  /** Google won't let this account (an organization's admin, say). */
  | "blocked"
  /** The project is gone from their Apps Script. */
  | "missing"
  | "failed";

/** Why Google's consent screen came back without the add-on's permission. */
export type ConsentProblem =
  "denied" | "emailMismatch" | "alreadyLinked" | "blocked" | "failed";

/** The error Google's consent screen (or Better Auth) came back with, for the person. */
export function consentProblem(error: string): ConsentProblem {
  if (error === "access_denied") return "denied";
  // Google Workspace's admin doesn't allow FaceOn this access.
  if (error === "admin_policy_enforced") return "blocked";
  const problem = linkProblem(error);
  return problem === "generic" ? "failed" : problem;
}

/** What /api/integrations/google-addon answers. */
export type AddonReply = {
  addon: AddonSetup;
  problem?: AddonProblem;
  /** Where to turn the Apps Script API on: only for admins, with "serviceDisabled". */
  consoleUrl?: string;
};

/** The person's add-on in Google's Apps Script editor. */
export function scriptEditorUrl(scriptId: string): string {
  return `https://script.google.com/home/projects/${encodeURIComponent(scriptId)}/edit`;
}

/** Where someone turns their own Apps Script API on. */
export const APPS_SCRIPT_SETTINGS_URL =
  "https://script.google.com/home/usersettings";

export const GOOGLE_CALENDAR_URL = "https://calendar.google.com/";
