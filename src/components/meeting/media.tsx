"use client";

/**
 * The meeting client's media port. The room UI reads everything through useRoomMedia()
 * and renders video with <TrackView>; each provider adapter (providers/*) maps its SDK
 * onto these types. Nothing outside the adapters imports a media SDK.
 */
import {
  createContext,
  use,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";

import type { DevicePreferences } from "@/lib/device/preferences";
import type { DeviceProblem } from "@/lib/device/problems";
import type { CameraProcessor, JoinInfo } from "@/lib/media/types";
import type {
  EventSender,
  ReactionCode,
  RoomEvent,
  SharedSessionState,
} from "@/lib/meetings/events";

export type ConnectionQuality = "good" | "poor" | "unknown";

/**
 * Someone in the meeting. One entry per connection: two devices are two entries. Their
 * voice isn't here (whether they're speaking, how loud, who's speaking most): it changes
 * many times a second, so the components that show it read it themselves (useSpeaking,
 * useAudioLevel, useDominantSpeakerKey), and the room doesn't redraw with every word.
 */
export type RoomParticipant = {
  key: string;
  userId: string;
  name: string;
  image: string | undefined;
  isLocal: boolean;
  /** When they joined (ms since epoch); keeps the tile order stable. */
  joinedAt: number;
  audio: boolean;
  video: boolean;
  screen: boolean;
  connection: ConnectionQuality;
};

export type InputDevice = {
  /** On, optimistically while a toggle is in flight. */
  enabled: boolean;
  /** The live track while it's on, for a level meter or a preview. */
  track: MediaStreamTrack | null;
  /** Whether you may turn it on: a host's policy can take that away. */
  allowed: boolean;
  problem: DeviceProblem | null;
  devices: MediaDeviceInfo[];
  selectedId: string | undefined;
  toggle: () => Promise<void>;
  select: (deviceId: string) => Promise<void>;
};

export type RoomStatus = "joined" | "reconnecting" | "offline";

/** What the Share screen menu asks the browser for. */
export type ShareOptions = {
  /** The list the browser's picker opens on. Only Chromium browsers take the hint. */
  surface?: "browser" | "window" | "monitor";
  /** Share the tab's or the computer's sound too. */
  audio: boolean;
  /** Smooth motion for video clips, instead of sharp text at a low frame rate. */
  motion: boolean;
};

/** Why the room closed; the left-meeting screen words its message from it. */
export type LeaveReason =
  "left" | "ended" | "removed" | "timeLimit" | "connectionLost";

export type RoomMedia = {
  status: RoomStatus;
  /** Raised hands and the host's policies; null until the provider has delivered them. */
  sessionState: SharedSessionState | null;
  participants: RoomParticipant[];
  mic: InputDevice & {
    /** You seem to be talking while muted. */
    speakingWhileMuted: boolean;
    /** Turns the browser's noise suppression on or off, now and for the rest of the call. */
    setNoiseSuppression: (on: boolean) => Promise<void>;
  };
  camera: InputDevice & {
    flip: () => Promise<void>;
    /** Runs a processor on the camera (backgrounds and effects); null removes it. */
    setProcessor: (processor: CameraProcessor | null) => Promise<void>;
  };
  speaker: {
    /** False where the browser can't choose an output device (Safari, phones). */
    supported: boolean;
    devices: MediaDeviceInfo[];
    selectedId: string | undefined;
    select: (deviceId: string) => void;
  };
  screenShare: {
    enabled: boolean;
    /** Whether you may share: hosts can keep sharing to themselves. */
    allowed: boolean;
    /** Opens the browser's picker and shares what you choose. */
    start: (options: ShareOptions) => Promise<void>;
    stop: () => Promise<void>;
  };
  leave: () => Promise<void>;

  /** Sends a chat message or prompt to everyone in the meeting. */
  sendEvent: (event: RoomEvent) => Promise<void>;
  /**
   * Events from others, already validated; the sender is null when our server sent the
   * event. Returns the unsubscribe function.
   */
  subscribeEvents: (
    handler: (event: RoomEvent, sender: EventSender | null) => void,
  ) => () => void;
  /** When a host turns off your mic, camera or screen share. Returns the unsubscribe function. */
  subscribeHostMutes: (
    handler: (kind: "audio" | "video" | "screen") => void,
  ) => () => void;
  sendReaction: (code: ReactionCode) => Promise<void>;
  /** Whether someone (by participant key) is speaking right now. */
  speakingOf: (key: string) => boolean;
  /** How loud someone is right now, from 0 to 1. */
  audioLevelOf: (key: string) => number;
  /** Whoever has been speaking most lately. */
  dominantSpeakerOf: () => string | undefined;
  /** Calls `onChange` whenever anyone's voice may have changed. Returns the unsubscribe function. */
  subscribeVoices: (onChange: () => void) => () => void;
  /** Everyone's reactions, your own included. Returns the unsubscribe function. */
  subscribeReactions: (
    handler: (reaction: { userId: string; code: ReactionCode }) => void,
  ) => () => void;
};

export type TrackViewProps = {
  participant: RoomParticipant;
  kind: "video" | "screen";
  className?: string;
};

/** What every adapter's room component takes. */
export type RoomAdapterProps = {
  connection: JoinInfo;
  self: { id: string; name: string; image?: string };
  devices: DevicePreferences;
  /** A background or effect to apply before the camera first sends anything. */
  cameraProcessor?: CameraProcessor;
  refreshToken: () => Promise<string>;
  onLeft: (reason: LeaveReason) => void;
  /** Shown while connecting. */
  fallback: ReactNode;
  children: ReactNode;
};

type RoomMediaContextValue = {
  media: RoomMedia;
  TrackView: ComponentType<TrackViewProps>;
};

const RoomMediaContext = createContext<RoomMediaContextValue | null>(null);

/** Adapters wrap the room UI in this, with their media state and track renderer. */
export function RoomMediaProvider({
  value,
  children,
}: {
  value: RoomMediaContextValue;
  children: ReactNode;
}) {
  return <RoomMediaContext value={value}>{children}</RoomMediaContext>;
}

function useRoomMediaContext(): RoomMediaContextValue {
  const context = use(RoomMediaContext);
  if (!context) throw new Error("Room media is used outside a meeting room.");
  return context;
}

export function useRoomMedia(): RoomMedia {
  return useRoomMediaContext().media;
}

const noLevel = () => 0;
const notSpeaking = () => false;
const nobody = () => undefined;

/** Whether a participant is speaking, for the component that shows it. */
export function useSpeaking(key: string): boolean {
  const { speakingOf, subscribeVoices } = useRoomMedia();
  return useSyncExternalStore(
    subscribeVoices,
    () => speakingOf(key),
    notSpeaking,
  );
}

/**
 * How loud a participant is, from 0 to 1 in steps of 0.05, for a voice indicator; 0
 * while `listening` is false (when they aren't speaking, say), so the component that
 * asks redraws only while there's a level to show.
 */
export function useAudioLevel(key: string, listening = true): number {
  const { audioLevelOf, subscribeVoices } = useRoomMedia();
  return useSyncExternalStore(
    subscribeVoices,
    listening ? () => Math.round(audioLevelOf(key) * 20) / 20 : noLevel,
    noLevel,
  );
}

/** The key of whoever has been speaking most lately, for layouts that follow them. */
export function useDominantSpeakerKey(): string | undefined {
  const { dominantSpeakerOf, subscribeVoices } = useRoomMedia();
  return useSyncExternalStore(subscribeVoices, dominantSpeakerOf, nobody);
}

/** A participant's camera or screen share, rendered by the active adapter. */
export function TrackView(props: TrackViewProps) {
  const { TrackView: AdapterTrackView } = useRoomMediaContext();
  return <AdapterTrackView {...props} />;
}
