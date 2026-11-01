"use client";

/**
 * The meeting client's media port. The room UI reads everything through useRoomMedia()
 * and renders video with <TrackView>; each provider adapter (providers/*) maps its SDK
 * onto these types. Nothing outside the adapters imports a media SDK.
 */
import { createContext, use, type ComponentType, type ReactNode } from "react";

import type { DevicePreferences } from "@/lib/device/preferences";
import type { DeviceProblem } from "@/lib/device/problems";
import type { JoinInfo } from "@/lib/media/types";

export type ConnectionQuality = "good" | "poor" | "unknown";

/** Someone in the meeting. One entry per connection: two devices are two entries. */
export type RoomParticipant = {
  key: string;
  userId: string;
  name: string;
  image: string | undefined;
  isLocal: boolean;
  isHost: boolean;
  /** When they joined (ms since epoch); keeps the tile order stable. */
  joinedAt: number;
  audio: boolean;
  video: boolean;
  screen: boolean;
  speaking: boolean;
  connection: ConnectionQuality;
};

export type InputDevice = {
  /** On, optimistically while a toggle is in flight. */
  enabled: boolean;
  problem: DeviceProblem | null;
  devices: MediaDeviceInfo[];
  selectedId: string | undefined;
  toggle: () => Promise<void>;
  select: (deviceId: string) => Promise<void>;
};

export type RoomStatus = "joined" | "reconnecting" | "offline";

/** Why the room closed; the left-meeting screen words its message from it. */
export type LeaveReason =
  "left" | "ended" | "removed" | "timeLimit" | "connectionLost";

export type RoomMedia = {
  status: RoomStatus;
  participants: RoomParticipant[];
  dominantSpeakerKey: string | undefined;
  mic: InputDevice;
  camera: InputDevice & { flip: () => Promise<void> };
  speaker: {
    /** False where the browser can't choose an output device (Safari, phones). */
    supported: boolean;
    devices: MediaDeviceInfo[];
    selectedId: string | undefined;
    select: (deviceId: string) => void;
  };
  screenShare: { enabled: boolean; toggle: () => Promise<void> };
  leave: () => Promise<void>;
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

/** A participant's camera or screen share, rendered by the active adapter. */
export function TrackView(props: TrackViewProps) {
  const { TrackView: AdapterTrackView } = useRoomMediaContext();
  return <AdapterTrackView {...props} />;
}
