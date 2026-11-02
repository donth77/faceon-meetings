import { cronAuthorized } from "@/lib/cron";
import { sweep } from "@/lib/meetings/sweep";

/** GET (Vercel Cron) or POST /api/cron/sweep: runs the housekeeping sweep. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sweep());
}

export const POST = GET;
