import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { wakesDatabase } from "@/lib/db/wake";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * Wakes a sleeping database (one `select 1`, nothing read or written), so the request
 * someone is about to make doesn't wait for it. Pages call it once as a visitor shows
 * intent (components/app-shell/wake-on-intent.tsx). It answers the same way whatever
 * happens, and does nothing where the database doesn't sleep.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request) || !wakesDatabase()) {
    return new Response(null, { status: 204 });
  }
  try {
    await db().execute(sql`select 1`);
  } catch {
    // Waking is only a head start; the real request reports any problem.
  }
  return new Response(null, { status: 204 });
}
