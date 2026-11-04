import { cronAuthorized } from "@/lib/cron";
import { readingsOf, usageReport } from "@/lib/usage/usage";

/**
 * GET /api/cron/usage: this month's usage of each free allowance, as Settings → Admin →
 * Usage this month shows it, for a script or monitor holding CRON_SECRET: the report,
 * and `meters`, each meter that's set up as the daily sweep reads it, most critical
 * first. Counts only.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await usageReport();
  return Response.json(
    { ...report, meters: readingsOf(report) },
    { headers: { "cache-control": "no-store" } },
  );
}
