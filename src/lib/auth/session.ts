import "server-only";

import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { SESSION_ENDED_ROUTE, signInPath } from "@/lib/routes";

import { auth } from "./server";

/**
 * The signed-in session, or null. Deduplicated per request, so layouts and pages can
 * both ask. Reads request headers, so the caller is dynamic.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * The signed-in session, or a redirect to sign-in that comes back to `returnTo`.
 * The proxy's cookie check is only optimistic; pages that need an account call this.
 * A cookie whose session has ended is cleared on the way, or the proxy, seeing it,
 * would send sign-in straight back here.
 */
export async function requireSession(returnTo: string) {
  const session = await getSession();
  if (!session) {
    const next = encodeURIComponent(returnTo);
    redirect(
      getSessionCookie(await headers()) === null
        ? signInPath(returnTo)
        : `${SESSION_ENDED_ROUTE}?next=${next}`,
    );
  }
  return session;
}
