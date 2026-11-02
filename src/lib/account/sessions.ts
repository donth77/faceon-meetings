import "server-only";

import { lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { session } from "@/lib/db/schema";

/**
 * Deletes sign-in sessions that expired before `now`, with the IP address and browser
 * each kept, as the privacy policy says. Better Auth deletes an expired session only
 * when it's next used; the daily sweep catches the ones that never are.
 */
export async function pruneExpiredSessions(now: Date): Promise<number> {
  const deleted = await db()
    .delete(session)
    .where(lt(session.expiresAt, now))
    .returning({ id: session.id });
  return deleted.length;
}
