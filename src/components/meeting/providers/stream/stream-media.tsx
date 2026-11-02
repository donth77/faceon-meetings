"use client";

import {
  CallingState,
  hasAudio,
  hasScreenShare,
  hasVideo,
  ParticipantsAudio,
  SfuModels,
  useCallStateHooks,
  type Call,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { deviceProblem } from "@/lib/device/problems";
import {
  isReactionCode,
  RoomEvent,
  SharedSessionState,
} from "@/lib/meetings/events";

import {
  RoomMediaProvider,
  type ConnectionQuality,
  type LeaveReason,
  type RoomMedia,
  type RoomParticipant,
  type RoomStatus,
} from "../../media";
import { StreamTrackView } from "./stream-track-view";

const HOST_ROLES = new Set(["host", "cohost"]);

function connectionOf(p: StreamVideoParticipant): ConnectionQuality {
  switch (p.connectionQuality) {
    case SfuModels.ConnectionQuality.POOR:
      return "poor";
    case SfuModels.ConnectionQuality.UNSPECIFIED:
      return "unknown";
    default:
      return "good";
  }
}

/** Stream's join time for a participant, in ms on Stream's clock. */
const joinTimeOf = (p: StreamVideoParticipant) =>
  p.joinedAt ? Number(p.joinedAt.seconds) * 1000 : 0;

function toRoomParticipant(
  p: StreamVideoParticipant,
  clockSkew: number,
): RoomParticipant {
  const joinedAt = joinTimeOf(p);
  return {
    key: p.sessionId,
    userId: p.userId,
    name: p.name || p.userId,
    image: p.image || undefined,
    isLocal: p.isLocalParticipant === true,
    isHost: p.roles.some((role) => HOST_ROLES.has(role)),
    joinedAt: joinedAt > 0 ? joinedAt - clockSkew : 0,
    audio: hasAudio(p),
    video: hasVideo(p),
    screen: hasScreenShare(p),
    speaking: p.isSpeaking,
    connection: connectionOf(p),
  };
}

function statusOf(state: CallingState): RoomStatus {
  if (state === CallingState.OFFLINE) return "offline";
  if (state === CallingState.RECONNECTING || state === CallingState.MIGRATING) {
    return "reconnecting";
  }
  return "joined";
}

const supportsSpeakerSelection = () =>
  typeof HTMLMediaElement !== "undefined" &&
  "setSinkId" in HTMLMediaElement.prototype;

/** Maps Stream's call state onto room media for the UI, and plays everyone else's audio. */
export function StreamMedia({
  call,
  joinedAt,
  onLeft,
  children,
}: {
  call: Call;
  /** When this browser finished joining, on its own clock. */
  joinedAt: number;
  onLeft: (reason: LeaveReason) => void;
  children: ReactNode;
}) {
  const {
    useParticipants,
    useCallCallingState,
    useDominantSpeaker,
    useMicrophoneState,
    useCameraState,
    useSpeakerState,
    useScreenShareState,
    useCallCustomData,
  } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();
  const dominantSpeaker = useDominantSpeaker();
  const mic = useMicrophoneState({ optimisticUpdates: true });
  const camera = useCameraState({ optimisticUpdates: true });
  const speaker = useSpeakerState();
  const screenShare = useScreenShareState({ optimisticUpdates: true });
  // Our server writes the complete state in order, so the latest custom data is current.
  const customData = useCallCustomData();
  const sessionState = useMemo(() => {
    const parsed = SharedSessionState.safeParse(customData);
    return parsed.success ? parsed.data : null;
  }, [customData]);

  // Why the call is closing, noted by the events that close it.
  const leaveReason = useRef<LeaveReason | null>(null);
  const reportLeft = useEffectEvent((reason: LeaveReason) => onLeft(reason));

  useEffect(() => {
    // The media server's notice often comes first, and the SDK leaves on it.
    const offServerEnded = call.on("callEnded", (event) => {
      leaveReason.current ??=
        event.reason === SfuModels.CallEndedReason.KICKED ? "removed" : "ended";
    });
    const offEnded = call.on("call.ended", (event) => {
      if (/duration/i.test(event.reason ?? "")) {
        leaveReason.current = "timeLimit";
      } else {
        leaveReason.current ??= "ended";
      }
    });
    const offKicked = call.on("call.kicked_user", (event) => {
      if (event.user.id === call.currentUserId) {
        leaveReason.current ??= "removed";
      }
    });
    return () => {
      offServerEnded();
      offEnded();
      offKicked();
    };
  }, [call]);

  useEffect(() => {
    if (callingState === CallingState.LEFT) {
      const ended = call.state.endedAt !== undefined;
      reportLeft(leaveReason.current ?? (ended ? "ended" : "left"));
    } else if (callingState === CallingState.RECONNECTING_FAILED) {
      reportLeft("connectionLost");
    }
  }, [call, callingState]);

  // Stream's clock and this device's can differ by seconds. Shift join times onto ours,
  // using our own join as the reference, so the meeting timer is right.
  const local = participants.find((p) => p.isLocalParticipant);
  const clockSkew =
    local && joinTimeOf(local) > 0 ? joinTimeOf(local) - joinedAt : 0;

  // Stable for the life of the call, so subscribers don't resubscribe on every render.
  const actions = useMemo<
    Pick<
      RoomMedia,
      | "leave"
      | "sendEvent"
      | "subscribeEvents"
      | "sendReaction"
      | "subscribeReactions"
    >
  >(
    () => ({
      leave: async () => {
        leaveReason.current = "left";
        await call.leave();
      },
      sendEvent: async (event) => {
        await call.sendCustomEvent(event);
      },
      subscribeEvents: (handler) =>
        call.on("custom", (event) => {
          const parsed = RoomEvent.safeParse(event.custom);
          if (!parsed.success) return;
          handler(parsed.data, {
            userId: event.user.id,
            name: event.user.name || event.user.id,
            ...(event.user.image ? { image: event.user.image } : {}),
          });
        }),
      sendReaction: async (code) => {
        await call.sendReaction({ type: "reaction", emoji_code: code });
      },
      subscribeReactions: (handler) =>
        call.on("call.reaction_new", (event) => {
          const code = event.reaction.emoji_code;
          if (isReactionCode(code)) {
            handler({ userId: event.reaction.user.id, code });
          }
        }),
    }),
    [call],
  );

  const media = useMemo<RoomMedia>(
    () => ({
      status: statusOf(callingState),
      sessionState,
      participants: participants.map((p) => toRoomParticipant(p, clockSkew)),
      dominantSpeakerKey: dominantSpeaker?.sessionId,
      mic: {
        enabled: !mic.optionsAwareIsMute,
        problem: mic.error ? deviceProblem(mic.error) : null,
        devices: mic.devices,
        selectedId: mic.selectedDevice,
        toggle: () => mic.microphone.toggle(),
        select: (deviceId) => mic.microphone.select(deviceId),
      },
      camera: {
        enabled: !camera.optionsAwareIsMute,
        problem: camera.error ? deviceProblem(camera.error) : null,
        devices: camera.devices,
        selectedId: camera.selectedDevice,
        toggle: () => camera.camera.toggle(),
        select: (deviceId) => camera.camera.select(deviceId),
        flip: () => camera.camera.flip(),
      },
      speaker: {
        supported:
          speaker.isDeviceSelectionSupported && supportsSpeakerSelection(),
        devices: speaker.devices,
        selectedId: speaker.selectedDevice || undefined,
        select: (deviceId) => speaker.speaker.select(deviceId),
      },
      screenShare: {
        enabled: !screenShare.optionsAwareIsMute,
        toggle: () => screenShare.screenShare.toggle(),
      },
      ...actions,
    }),
    [
      actions,
      callingState,
      clockSkew,
      participants,
      dominantSpeaker,
      mic,
      camera,
      speaker,
      screenShare,
      sessionState,
    ],
  );

  const remote = useMemo(
    () => participants.filter((p) => !p.isLocalParticipant),
    [participants],
  );

  return (
    <RoomMediaProvider value={{ media, TrackView: StreamTrackView }}>
      <ParticipantsAudio participants={remote} />
      {children}
    </RoomMediaProvider>
  );
}
