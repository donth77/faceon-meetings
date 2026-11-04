import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { connection } from "next/server";

import { db } from "@/lib/db";
import { HEALTH_WINDOW_MS, windowOf } from "@/lib/db/wake-rule";

/**
 * One database check per window (HEALTH_WINDOW_MS), shared by every server: the window's
 * first ?db=1 runs `select 1`, and the rest of the window gets its answer.
 */
async function databaseAnswers(
  slot: number,
): Promise<{ slot: number; ok: boolean }> {
  "use cache";
  const seconds = HEALTH_WINDOW_MS / 1000;
  cacheLife({ stale: seconds, revalidate: seconds, expire: seconds * 2 });
  try {
    await db().execute(sql`select 1`);
    return { slot, ok: true };
  } catch {
    return { slot, ok: false };
  }
}

/**
 * GET /api/health: for uptime monitors. 200 while the app answers, without touching the
 * database, so pinging it every few minutes never keeps a sleeping database awake.
 * `?db=1` also checks the database, at most once an hour whoever asks, and answers 503
 * when it didn't respond: worth a slow monitor of its own (every 12 hours, say).
 */
export async function GET(request: Request) {
  await connection();
  const headers = { "cache-control": "no-store" };
  if (new URL(request.url).searchParams.get("db") !== "1") {
    return Response.json({ ok: true }, { headers });
  }
  const { ok } = await databaseAnswers(windowOf(Date.now(), HEALTH_WINDOW_MS));
  return Response.json(
    { ok, database: ok ? "ok" : "unreachable" },
    { status: ok ? 200 : 503, headers },
  );
}
