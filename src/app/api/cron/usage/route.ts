import { cronAuthorized } from "@/lib/cron";
import { usageReport } from "@/lib/usage/usage";

/**
 * GET /api/cron/usage: this month's usage of each free allowance, as Settings → Admin →
 * Usage this month shows it, for a script or monitor holding CRON_SECRET. Counts only.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await usageReport(), {
    headers: { "cache-control": "no-store" },
  });
}
