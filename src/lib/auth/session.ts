import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SIGN_IN_ROUTE } from "@/lib/routes";

import { auth } from "./server";

/** The signed-in session, or null. Reads request headers, so the caller is dynamic. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * The signed-in session, or a redirect to sign-in that comes back to `returnTo`.
 * The proxy's cookie check is only optimistic; pages that need an account call this.
 */
export async function requireSession(returnTo: string) {
  const session = await getSession();
  if (!session) {
    redirect(`${SIGN_IN_ROUTE}?next=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
