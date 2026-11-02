import "server-only";

import { createHmac } from "node:crypto";
import { and, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { attemptCounter, rateLimit } from "@/lib/db/schema";
import { serverEnv } from "@/lib/server-env";

/** A counter key and how many attempts it allows per window. */
export type AttemptLimit = { key: string; max: number };

const WINDOW_MS = 10 * 60 * 1000;

/** The caller's IP address as a keyed hash, so raw addresses are never stored. */
export function hashedClientIp(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", serverEnv().BETTER_AUTH_SECRET ?? "")
    .update(`attempts:${ip}`)
    .digest("base64url")
    .slice(0, 22);
}

/** True when any key has used up its attempts in the current window. */
export async function isLimited(limits: AttemptLimit[]): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db()
    .select()
    .from(attemptCounter)
    .where(
      and(
        inArray(
          attemptCounter.key,
          limits.map((limit) => limit.key),
        ),
        gte(attemptCounter.windowStart, since),
      ),
    );
  return rows.some(
    (row) =>
      row.count >=
      (limits.find((limit) => limit.key === row.key)?.max ?? Infinity),
  );
}

/** Counts one attempt against every key, starting a new window where the old one ran out. */
export async function recordAttempt(limits: AttemptLimit[]): Promise<void> {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_MS);
  const expired = sql`${attemptCounter.windowStart} < ${since}`;
  await db()
    .insert(attemptCounter)
    .values(limits.map(({ key }) => ({ key, windowStart: now, count: 1 })))
    .onConflictDoUpdate({
      target: attemptCounter.key,
      set: {
        count: sql`case when ${expired} then 1 else ${attemptCounter.count} + 1 end`,
        windowStart: sql`case when ${expired} then excluded.window_start else ${attemptCounter.windowStart} end`,
      },
    });
}

/** Deletes counters whose window ended long ago. Returns how many. */
/**
 * Better Auth's own sign-in rate limits keep the IP address in each record and never
 * delete them; these go after a day too.
 */
export async function pruneAuthRateLimits(before: Date): Promise<number> {
  const deleted = await db()
    .delete(rateLimit)
    .where(lt(rateLimit.lastRequest, before.getTime()))
    .returning({ id: rateLimit.id });
  return deleted.length;
}

export async function pruneAttempts(before: Date): Promise<number> {
  const deleted = await db()
    .delete(attemptCounter)
    .where(lt(attemptCounter.windowStart, before))
    .returning({ key: attemptCounter.key });
  return deleted.length;
}
