import { gunzipSync } from "node:zlib";

import type { AttendanceEvent } from "@/lib/media/types";
import { isUuid } from "@/lib/uuid";
import { z } from "@/lib/zod";

import { CALL_TYPE } from "./constants";

const STREAM_WEBHOOK = {
  joined: "call.session_participant_joined",
  left: "call.session_participant_left",
};

/** The most a delivery may hold, unzipped: Stream's events are a few kilobytes. */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * A delivery's body as Stream signed it, or null when there's no such thing. Stream may
 * gzip what it sends, and signs the JSON before that, so a gzipped body (known by its
 * first bytes, in case something on the way unzipped it already) is unzipped first, and
 * never past 1 MB, since anyone can send one.
 */
export function signedWebhookBody(body: Buffer): Buffer | null {
  if (body.length > MAX_BODY_BYTES) return null;
  if (body[0] !== 0x1f || body[1] !== 0x8b) return body;
  try {
    return gunzipSync(body, { maxOutputLength: MAX_BODY_BYTES });
  } catch {
    return null;
  }
}

/**
 * What a delivery that was turned away looked like, for an error report: enough to tell
 * Stream's from anyone else's and what about it didn't match, never its body or signature.
 */
export function refusedDelivery(
  headers: Headers,
  body: Buffer,
  apiKey: string | undefined,
): Record<string, string | number> {
  const signature = headers.get("x-signature");
  const key = headers.get("x-api-key");
  const sent = [...headers.keys()]
    .filter(
      (name) =>
        name.startsWith("x-") &&
        !/^x-(vercel|forwarded|real-ip|middleware|matched)/.test(name),
    )
    .sort();
  return {
    bytes: body.length,
    gzipped: body[0] === 0x1f && body[1] === 0x8b ? "yes" : "no",
    encoding: headers.get("content-encoding") ?? "none",
    signature: !signature
      ? "none"
      : /^[0-9a-f]{64}$/.test(signature)
        ? "sha256 hex"
        : `other, ${signature.length} characters`,
    api_key: !key ? "none" : key === apiKey ? "ours" : "another",
    headers: sent.join(" ").slice(0, 200) || "none",
    agent: (headers.get("user-agent") ?? "none").split("/")[0]!.slice(0, 40),
  };
}

/** A time Stream sent, or none when it's missing or unreadable. */
const Timestamp = z.iso.datetime({ offset: true }).optional().catch(undefined);

/** The parts of a participant event we keep. Anything else in the body is ignored. */
const ParticipantEvent = z.object({
  type: z.string(),
  call_cid: z.string(),
  created_at: Timestamp,
  participant: z.object({
    user_session_id: z.string().min(1).max(200),
    joined_at: Timestamp,
    user: z
      .object({
        id: z.string().min(1).max(200),
        name: z.string().max(500).optional().catch(undefined),
        image: z.string().max(2048).optional().catch(undefined),
      })
      .optional()
      .catch(undefined),
  }),
});

/**
 * Attendance from a Stream webhook (already verified as Stream's), or null for events we
 * don't keep. A call that isn't one of our sessions, or a body that isn't what Stream
 * documents, is ignored rather than failing (Stream would retry it forever).
 */
export function parseStreamWebhook(body: unknown): AttendanceEvent | null {
  const parsed = ParticipantEvent.safeParse(body);
  if (!parsed.success) return null;
  const { type, call_cid, created_at, participant } = parsed.data;
  const [callType, sessionId = ""] = call_cid.split(":");
  if (callType !== CALL_TYPE || !isUuid(sessionId)) return null;
  const sent = created_at ? new Date(created_at) : new Date();

  if (type === STREAM_WEBHOOK.joined && participant.user) {
    return {
      type: "joined",
      sessionId,
      connectionId: participant.user_session_id,
      mediaUserId: participant.user.id,
      name: participant.user.name || participant.user.id,
      image: participant.user.image ?? null,
      at: participant.joined_at ? new Date(participant.joined_at) : sent,
    };
  }
  if (type === STREAM_WEBHOOK.left) {
    return {
      type: "left",
      sessionId,
      connectionId: participant.user_session_id,
      at: sent,
    };
  }
  return null;
}
