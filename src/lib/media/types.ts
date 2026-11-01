/**
 * The media-provider boundary. Code outside the adapter folders (src/lib/stream,
 * src/lib/livekit, src/components/meeting/providers) talks to media only through these
 * types, which keeps Stream and self-hosted LiveKit interchangeable. ESLint enforces it.
 */

export type MediaProviderId = "stream" | "livekit";

export type MeetingRole = "host" | "cohost" | "participant" | "guest";

export type MediaUser = { id: string; name: string; image?: string };

export type SessionLimits = {
  maxParticipants: number;
  /** The provider ends the call after this long; omit for no limit. */
  maxDurationSeconds?: number;
};

/** What a browser needs to connect once it has been admitted. */
export type JoinInfo = {
  provider: MediaProviderId;
  /** Stream: the public API key. LiveKit: the server URL. */
  endpoint: string;
  token: string;
  /** The session's call (Stream) or room (LiveKit). */
  room: string;
};

export type TrackKind = "audio" | "video" | "screenshare" | "screenshare_audio";

/** Shared session state every participant sees the same way. */
export type SessionState = {
  rev: number;
  locked: boolean;
  chat: boolean;
  reactions: boolean;
  screenShare: "host" | "all";
  /** userId → when the hand went up (ISO 8601). */
  hands: Record<string, string>;
};

/** Events the server pushes into a session. They carry no names or other personal data. */
export type ServerEvent =
  | { type: "lobby.updated"; count: number }
  | { type: "host.request_unmute"; target: string };

export type NormalizedWebhookEvent =
  | { type: "session.started"; room: string; at: string }
  | { type: "session.ended"; room: string; at: string }
  | {
      type: "participant.joined";
      room: string;
      userId: string;
      connectionId: string;
      at: string;
    }
  | {
      type: "participant.left";
      room: string;
      userId: string;
      connectionId: string;
      at: string;
    };

/** Optional features; the UI hides whatever the active provider lacks. */
export type ProviderCapabilities = {
  transcription: boolean;
  recording: boolean;
  noiseCancellation: boolean;
  pinForEveryone: boolean;
};

export interface MediaProvider {
  readonly id: MediaProviderId;
  readonly capabilities: ProviderCapabilities;

  createSession(input: {
    sessionId: string;
    host: MediaUser;
    limits: SessionLimits;
  }): Promise<void>;
  endSession(sessionId: string): Promise<void>;
  isHostPresent(sessionId: string, hostUserId: string): Promise<boolean>;
  listParticipants(
    sessionId: string,
  ): Promise<Array<{ userId: string; connectionId: string }>>;

  admit(input: {
    sessionId: string;
    user: MediaUser;
    role: MeetingRole;
  }): Promise<JoinInfo>;
  refreshToken(input: {
    sessionId: string;
    userId: string;
    role: MeetingRole;
  }): Promise<string>;

  setRole(sessionId: string, userId: string, role: MeetingRole): Promise<void>;
  setPublishPermissions(
    sessionId: string,
    userId: string,
    allowed: { audio: boolean; video: boolean; screen: boolean },
  ): Promise<void>;
  mute(sessionId: string, userId: string, kind: TrackKind): Promise<void>;
  muteAll(sessionId: string, kind: "audio" | "video"): Promise<void>;
  remove(
    sessionId: string,
    userId: string,
    options: { block: boolean },
  ): Promise<void>;

  setSessionState(sessionId: string, state: SessionState): Promise<void>;
  sendServerEvent(sessionId: string, event: ServerEvent): Promise<void>;
  parseWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<NormalizedWebhookEvent[]>;
}
