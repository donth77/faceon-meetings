import { createHash } from "node:crypto";

import { lowerHandOnLeave, recordAttendance } from "@/lib/meetings/attendance";
import { parseStreamWebhook, verifyStreamWebhook } from "@/lib/stream/server";

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
    // A hand left raised by someone who's gone would greet them when they come back.
    await lowerHandOnLeave(event).catch((error: unknown) =>
      console.error("Could not lower the hand of someone who left.", error),
    );
  }
  return new Response(null, { status: 200 });
}
