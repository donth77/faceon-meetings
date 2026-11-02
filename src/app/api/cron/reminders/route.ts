import { cronAuthorized } from "@/lib/cron";
import { sendDueReminders } from "@/lib/reminders/send";

/**
 * GET or POST /api/cron/reminders: emails the meeting reminders that are due. An outside
 * scheduler calls it every 5 minutes (cron-job.org; Vercel's free crons run only daily).
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sendDueReminders());
}

export const POST = GET;
