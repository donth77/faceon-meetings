import "server-only";

import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/server-env";

/**
 * Only the scheduler, which sends "Authorization: Bearer <CRON_SECRET>": Vercel Cron, for
 * the daily sweep, and scripts or monitors reading the usage figures (/api/cron/usage).
 * Without a secret, nothing is let in.
 */
export function cronAuthorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
