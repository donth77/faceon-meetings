import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { refreshAccessToken } from "better-auth/oauth2";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** What a watched token request learned: whether Google refused the grant itself. */
export type RefreshWatch = { refused: boolean };

const watches = new AsyncLocalStorage<RefreshWatch>();

/**
 * Runs `task`, which may refresh a Google token through Better Auth, noting in `watch`
 * whether Google refused the grant. Better Auth reports every failed refresh the same
 * way; only a refused grant means the host has to reconnect.
 */
export function watchGoogleRefresh<T>(
  watch: RefreshWatch,
  task: () => Promise<T>,
): Promise<T> {
  return watches.run(watch, task);
}

/** Google's answer when a grant was revoked, or expired (a test user's week is up). */
export function isRefusedGrant(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    error.error === "invalid_grant"
  );
}

/**
 * Better Auth's Google token refresh, as the Google provider does it, plus a note for
 * a watching sync when Google refuses the grant.
 */
export async function refreshGoogleToken(refreshToken: string) {
  try {
    return await refreshAccessToken({
      refreshToken,
      options: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      },
      tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
    });
  } catch (error) {
    const watch = watches.getStore();
    if (watch && isRefusedGrant(error)) watch.refused = true;
    throw error;
  }
}
