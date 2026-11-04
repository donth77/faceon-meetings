import "server-only";

import type { BetterAuthOptions } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { account, user } from "@/lib/db/schema";
import { serverEnv } from "@/lib/server-env";

import { decideLink, LINK_INTENT_COOKIE } from "./linking-rules";

type ValidateUserInfo = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["validateUserInfo"]
>;

/** A cookie's value from a request's Cookie header. */
function cookieFrom(
  headers: Headers | undefined,
  name: string,
): string | undefined {
  for (const part of headers?.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

/**
 * Better Auth's `validateUserInfo`: a link that `decideLink` (lib/auth/linking-rules.ts)
 * doesn't allow is refused with its code, which comes back to the page as `?error=`.
 * Everything else (creating an account, signing in) passes.
 */
export const checkLinkedAccount: ValidateUserInfo = async (data, ctx) => {
  const verdict = await decideLink(
    {
      action: data.source.action,
      providerId: data.source.oauth?.providerId ?? data.source.method,
      providerEmail: data.user.email,
      providerEmailVerified: data.user.emailVerified,
      userId: typeof data.user.id === "string" ? data.user.id : "",
    },
    {
      accountEmail: async (id) =>
        (await ctx.context.internalAdapter.findUserById(id))?.email ?? null,
      session: async () => {
        const found = await getSessionFromCtx(ctx, {
          disableCookieCache: true,
          disableRefresh: true,
        }).catch(() => null);
        return found
          ? { userId: found.user.id, sessionId: found.session.id }
          : null;
      },
      intent: () =>
        cookieFrom(ctx.request?.headers ?? ctx.headers, LINK_INTENT_COOKIE),
    },
    { now: new Date(), secret: serverEnv().BETTER_AUTH_SECRET ?? "" },
  );
  return verdict === "allow" ? undefined : { error: verdict };
};

/**
 * Before Google or GitHub is linked to an account whose email was never verified, its
 * password goes. Anyone could have signed up with that address and a password; once
 * the provider proves who owns the address, that password must not open the account.
 */
export async function dropUnverifiedPassword(userId: string): Promise<void> {
  const [owner] = await db()
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!owner || owner.emailVerified) return;
  await db()
    .delete(account)
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    );
}
