import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

/*
 * Whether an account uses the desktop app: noted when it signs the app in
 * (lib/auth/desktop-handoff.ts) and when Home opens inside the app (lib/desktop/actions.ts),
 * which covers anyone signed in before this was noted. Home's card then stops suggesting
 * the app in browsers (lib/desktop/downloads.ts, homeInstallCard).
 */

export async function desktopAppUsedBy(userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ at: user.desktopAppAt })
    .from(user)
    .where(eq(user.id, userId));
  return Boolean(row?.at);
}

/** Notes the first time an account uses the desktop app; later times change nothing. */
export async function noteDesktopAppUsed(userId: string): Promise<void> {
  await db()
    .update(user)
    .set({ desktopAppAt: new Date() })
    .where(and(eq(user.id, userId), isNull(user.desktopAppAt)));
}
