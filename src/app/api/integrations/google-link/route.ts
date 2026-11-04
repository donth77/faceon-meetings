import {
  FRESH_SIGN_IN_MS,
  isFreshSignIn,
  LINK_INTENT_COOKIE,
  LINK_INTENT_PATH,
  linkIntentToken,
} from "@/lib/auth/linking-rules";
import { auth } from "@/lib/auth/server";
import { isSameOrigin } from "@/lib/same-origin";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

const NO_STORE = { "cache-control": "no-store" };

/**
 * POST /api/integrations/google-link: the caller confirmed connecting a Google account
 * whose email isn't their account's. Within FRESH_SIGN_IN_MS of signing in, it sets the
 * short-lived cookie that lets Better Auth's callback link one (lib/auth/linking-rules.ts),
 * for this session only, and answers 204; after that it answers 403 with
 * `{ problem: "signInAgain" }`.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) return new Response(null, { status: 401 });
  const now = new Date();
  if (!isFreshSignIn(new Date(session.session.createdAt), now)) {
    return Response.json(
      { problem: "signInAgain" },
      { status: 403, headers: NO_STORE },
    );
  }
  const secret = serverEnv().BETTER_AUTH_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const token = linkIntentToken({
    userId: session.user.id,
    sessionId: session.session.id,
    now,
    secret,
  });
  const cookie = [
    `${LINK_INTENT_COOKIE}=${token}`,
    `Path=${LINK_INTENT_PATH}`,
    `Max-Age=${FRESH_SIGN_IN_MS / 1000}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(siteUrl().startsWith("https://") ? ["Secure"] : []),
  ].join("; ");
  return new Response(null, {
    status: 204,
    headers: { ...NO_STORE, "set-cookie": cookie },
  });
}
