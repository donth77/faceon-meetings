import { timingSafeEqual } from "node:crypto";

import { sweep } from "@/lib/meetings/sweep";
import { serverEnv } from "@/lib/server-env";

/** Only the scheduler, which sends "Authorization: Bearer <CRON_SECRET>". */
function authorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET (Vercel Cron) or POST /api/cron/sweep: runs the housekeeping sweep. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sweep());
}

export const POST = GET;
