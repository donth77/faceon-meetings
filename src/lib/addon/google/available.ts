import "server-only";

import { googleClientConfigured } from "@/lib/google-calendar/client";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

/**
 * Whether this copy offers FaceOn in Google Calendar and Gmail: switched on
 * (GOOGLE_ADDON), with Google sign-in, and on the internet, since Google's servers call
 * it over https.
 */
export function addonAvailable(): boolean {
  return (
    serverEnv().GOOGLE_ADDON === "on" &&
    googleClientConfigured() &&
    siteUrl().startsWith("https://")
  );
}
