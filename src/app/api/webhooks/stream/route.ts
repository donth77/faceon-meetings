import { createHash } from "node:crypto";

import {
  recordAttendance,
  tidyUpAfterLeaving,
} from "@/lib/meetings/attendance";
import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";
import { verifyStreamWebhook } from "@/lib/stream/server";
import {
  parseStreamWebhook,
  refusedDelivery,
  signedWebhookBody,
} from "@/lib/stream/webhook";

/**
 * A delivery turned away is reported at most this often: Stream retries each one, and
 * anyone can send them.
 */
const REFUSED_REPORT_MS = 60 * 60_000;
let refusedReportedAt = -Infinity;

/**
 * POST /api/webhooks/stream: Stream's webhooks, signed with our API secret. Attendance
 * events are recorded once each; everything else is acknowledged and ignored.
 */
export async function POST(request: Request) {
  const received = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-signature") ?? "";
  const body = signedWebhookBody(received);
  if (!signature || !body || !verifyStreamWebhook(body, signature)) {
    // Every delivery turned away is attendance missing from Previous and the usage meter.
    const now = Date.now();
    if (now - refusedReportedAt >= REFUSED_REPORT_MS) {
      refusedReportedAt = now;
      reportError(
        "Turned away a Stream webhook that wasn't signed with our API secret.",
        undefined,
        refusedDelivery(
          request.headers,
          received,
          serverEnv().NEXT_PUBLIC_STREAM_API_KEY,
        ),
      );
    }
    return new Response(null, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
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
      reportError("Could not tidy up after someone who left.", error),
    );
  }
  return new Response(null, { status: 200 });
}
