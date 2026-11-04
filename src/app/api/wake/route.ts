import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";

import { db } from "@/lib/db";
import { wakesDatabase } from "@/lib/db/wake";
import { WAKE_WINDOW_MS, windowOf } from "@/lib/db/wake-rule";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * One `select 1` per window (WAKE_WINDOW_MS), however many ask: the window's first call
 * wakes the database, and every later one in it gets the cached answer without reaching
 * the database.
 */
async function wakeIn(slot: number): Promise<{ slot: number; woke: boolean }> {
  "use cache";
  const seconds = WAKE_WINDOW_MS / 1000;
  cacheLife({ stale: seconds, revalidate: seconds, expire: seconds * 2 });
  try {
    await db().execute(sql`select 1`);
    return { slot, woke: true };
  } catch {
    // Waking is only a head start; the real request reports any problem.
    return { slot, woke: false };
  }
}

/**
 * Wakes a sleeping database (one `select 1`, nothing read or written), so the request
 * someone is about to make doesn't wait for it. Pages call it once as a visitor shows
 * intent (components/app-shell/wake-on-intent.tsx). It answers the same way whatever
 * happens, does nothing where the database doesn't sleep, and reaches the database at
 * most once every quarter of an hour, so calling it can't keep the database awake.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request) || !wakesDatabase()) {
    return new Response(null, { status: 204 });
  }
  await wakeIn(windowOf(Date.now(), WAKE_WINDOW_MS));
  return new Response(null, { status: 204 });
}
