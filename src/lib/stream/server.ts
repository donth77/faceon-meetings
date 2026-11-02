import "server-only";

import { StreamClient, StreamError } from "@stream-io/node-sdk";

import type {
  JoinInfo,
  MediaProvider,
  MediaUser,
  MeetingRole,
  SessionSnapshot,
  TrackKind,
} from "@/lib/media/types";
import { serverEnv } from "@/lib/server-env";

import { CALL_TYPE } from "./constants";

/** Call tokens last an hour; the client's token provider refreshes them through our API. */
const TOKEN_TTL_SECONDS = 60 * 60;

/** Our roles → call-member roles on the `meeting` call type. Non-members get no grants. */
const MEMBER_ROLE: Record<MeetingRole, string> = {
  host: "host",
  cohost: "cohost",
  participant: "call_member",
  guest: "call_member",
};

/** Publish grants that a host's policies can take away from someone. */
const PUBLISH_GRANTS = {
  audio: "send-audio",
  video: "send-video",
  screen: "screenshare",
} as const;

let client: StreamClient | undefined;

function stream(): StreamClient {
  if (!client) {
    const env = serverEnv();
    if (!env.NEXT_PUBLIC_STREAM_API_KEY || !env.STREAM_API_SECRET) {
      throw new Error(
        "Stream is enabled, but NEXT_PUBLIC_STREAM_API_KEY or STREAM_API_SECRET is not set.",
      );
    }
    client = new StreamClient(
      env.NEXT_PUBLIC_STREAM_API_KEY,
      env.STREAM_API_SECRET,
    );
  }
  return client;
}

/** Every session gets its own call, whose ID is the session ID. */
const callOf = (sessionId: string) => stream().video.call(CALL_TYPE, sessionId);

const systemUserId = () => serverEnv().STREAM_SYSTEM_USER_ID;

const isNotFound = (error: unknown) =>
  error instanceof StreamError && error.metadata.responseCode === 404;

const toStreamUser = (user: MediaUser) => ({
  id: user.id,
  name: user.name,
  ...(user.image ? { image: user.image } : {}),
});

function callToken(sessionId: string, userId: string): string {
  // Roles come from call membership, not the token, so a role change applies at once.
  return stream().generateCallToken({
    user_id: userId,
    call_cids: [`${CALL_TYPE}:${sessionId}`],
    validity_in_seconds: TOKEN_TTL_SECONDS,
  });
}

/** The Stream Video adapter for the media-provider interface. */
export const streamProvider: MediaProvider = {
  id: "stream",
  capabilities: {
    transcription: true,
    recording: true,
    noiseCancellation: true,
    pinForEveryone: true,
  },

  async createSession({ sessionId, host, limits, state }) {
    // The call's creator and first member must exist before the call does.
    await stream().upsertUsers([toStreamUser(host)]);
    await callOf(sessionId).getOrCreate({
      data: {
        created_by_id: host.id,
        members: [{ user_id: host.id, role: MEMBER_ROLE.host }],
        custom: { v: 1, ...state },
        settings_override: {
          limits: {
            max_participants: limits.maxParticipants,
            ...(limits.maxDurationSeconds
              ? { max_duration_seconds: limits.maxDurationSeconds }
              : {}),
          },
        },
      },
    });
  },

  async endSession(sessionId) {
    try {
      await callOf(sessionId).end();
    } catch (error) {
      // Ending twice, or ending a call that's gone, is fine.
      const snapshot = await streamProvider.inspectSession(sessionId);
      if (snapshot && !snapshot.ended) throw error;
    }
  },

  async inspectSession(sessionId): Promise<SessionSnapshot | null> {
    let call;
    try {
      ({ call } = await callOf(sessionId).get());
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    const connectedUserIds = [
      ...new Set(call.session?.participants.map((p) => p.user.id) ?? []),
    ];
    let emptySince: Date | null = null;
    if (connectedUserIds.length === 0) {
      // Never started: empty since it was created. Started but not yet marked ended:
      // everyone left moments ago.
      emptySince = call.session?.started_at
        ? (call.session.ended_at ?? new Date())
        : call.created_at;
    }
    return { ended: call.ended_at != null, connectedUserIds, emptySince };
  },

  async admit({ sessionId, user, role }): Promise<JoinInfo> {
    await stream().upsertUsers([toStreamUser(user)]);
    await callOf(sessionId).updateCallMembers({
      update_members: [{ user_id: user.id, role: MEMBER_ROLE[role] }],
    });
    return {
      provider: "stream",
      endpoint: serverEnv().NEXT_PUBLIC_STREAM_API_KEY ?? "",
      token: callToken(sessionId, user.id),
      room: sessionId,
    };
  },

  async refreshToken({ sessionId, userId }) {
    return callToken(sessionId, userId);
  },

  async setRole(sessionId, userId, role) {
    await callOf(sessionId).updateCallMembers({
      update_members: [{ user_id: userId, role: MEMBER_ROLE[role] }],
    });
  },

  async setPublishPermissions(sessionId, userId, changes) {
    const kinds = Object.keys(PUBLISH_GRANTS) as Array<
      keyof typeof PUBLISH_GRANTS
    >;
    const grants = (allowed: boolean) =>
      kinds.filter((k) => changes[k] === allowed).map((k) => PUBLISH_GRANTS[k]);
    // Stream turns off whatever someone is no longer allowed to publish.
    await callOf(sessionId).updateUserPermissions({
      user_id: userId,
      grant_permissions: grants(true),
      revoke_permissions: grants(false),
    });
  },

  async mute(sessionId, userIds, kinds: TrackKind[]) {
    if (userIds.length === 0) return;
    await callOf(sessionId).muteUsers({
      user_ids: userIds,
      ...Object.fromEntries(kinds.map((kind) => [kind, true])),
      muted_by_id: systemUserId(),
    });
  },

  async remove(sessionId, userId, { block }) {
    await callOf(sessionId).kickUser({
      user_id: userId,
      block,
      kicked_by_id: systemUserId(),
    });
    await callOf(sessionId).updateCallMembers({ remove_members: [userId] });
  },

  async setSessionState(sessionId, state) {
    // Always the complete object; clients ignore a lower `rev` than they've seen.
    await callOf(sessionId).update({ custom: { v: 1, ...state } });
  },

  async sendServerEvent(sessionId, event) {
    await callOf(sessionId).sendCallEvent({
      user_id: systemUserId(),
      custom: event,
    });
  },

  async forgetUser(userId) {
    // Stream deletes in the background; "hard" needs messages and conversations "hard" too.
    await stream().deleteUsers({
      user_ids: [userId],
      user: "hard",
      messages: "hard",
      conversations: "hard",
    });
  },
};

/** Whether a webhook really came from Stream: its body signed with our API secret. */
export function verifyStreamWebhook(body: string, signature: string): boolean {
  try {
    return stream().verifyWebhook(body, signature);
  } catch {
    return false;
  }
}
