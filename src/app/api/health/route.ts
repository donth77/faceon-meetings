import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/lib/db";

/** How long one database check stands for: pings in between never reach the database. */
const DATABASE_CHECK_MS = 60_000;
let lastCheck: { at: number; ok: boolean } | null = null;

async function databaseAnswers(): Promise<boolean> {
  if (lastCheck && Date.now() - lastCheck.at < DATABASE_CHECK_MS) {
    return lastCheck.ok;
  }
  let ok = false;
  try {
    await db().execute(sql`select 1`);
    ok = true;
  } catch {
    ok = false;
  }
  lastCheck = { at: Date.now(), ok };
  return ok;
}

/**
 * GET /api/health: for uptime monitors. 200 while the app answers, without touching the
 * database, so pinging it every few minutes never keeps a sleeping database awake.
 * `?db=1` also checks the database (one `select 1`, at most once a minute per server
 * instance) and answers 503 when it doesn't respond: worth a slower monitor of its own.
 */
export async function GET(request: Request) {
  await connection();
  const headers = { "cache-control": "no-store" };
  if (new URL(request.url).searchParams.get("db") !== "1") {
    return Response.json({ ok: true }, { headers });
  }
  const ok = await databaseAnswers();
  return Response.json(
    { ok, database: ok ? "ok" : "unreachable" },
    { status: ok ? 200 : 503, headers },
  );
}
