import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { account, user } from "@/lib/db/schema";

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
