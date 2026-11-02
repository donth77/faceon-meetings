import { createHash } from "node:crypto";

import { loggable } from "@/lib/log";
import {
  recordAttendance,
  tidyUpAfterLeaving,
} from "@/lib/meetings/attendance";
import { verifyStreamWebhook } from "@/lib/stream/server";
import { parseStreamWebhook } from "@/lib/stream/webhook";

/**
 * POST /api/webhooks/stream: Stream's webhooks, signed with our API secret. Attendance
 * events are recorded once each; everything else is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  if (!signature || !verifyStreamWebhook(body, signature)) {
    return new Response(null, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  // Stream names each delivery; without that header, the body itself identifies it.
  const deliveryId =
    request.headers.get("x-webhook-id") ??
    createHash("sha256").update(body).digest("hex");
  const event = parseStreamWebhook(payload);
  const result = await recordAttendance(deliveryId, event);
  if (result === "recorded" && event?.type === "left") {
    // A hand left raised would greet them when they come back, and AI notes they were
    // taking would have nobody to take them.
    await tidyUpAfterLeaving(event).catch((error: unknown) =>
      console.error(
        "Could not tidy up after someone who left.",
        loggable(error),
      ),
    );
  }
  return new Response(null, { status: 200 });
}
