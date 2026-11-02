import { z } from "zod";

import type { AttendanceEvent } from "@/lib/media/types";
import { isUuid } from "@/lib/uuid";

import { CALL_TYPE } from "./constants";

const STREAM_WEBHOOK = {
  joined: "call.session_participant_joined",
  left: "call.session_participant_left",
};

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
