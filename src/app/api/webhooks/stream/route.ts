import { createHash } from "node:crypto";

import { recordAttendance } from "@/lib/meetings/attendance";
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
  await recordAttendance(deliveryId, parseStreamWebhook(payload));
  return new Response(null, { status: 200 });
}
