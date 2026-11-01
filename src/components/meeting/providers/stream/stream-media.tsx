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

function toRoomParticipant(p: StreamVideoParticipant): RoomParticipant {
  return {
    key: p.sessionId,
    userId: p.userId,
    name: p.name || p.userId,
    image: p.image || undefined,
    isLocal: p.isLocalParticipant === true,
    isHost: p.roles.some((role) => HOST_ROLES.has(role)),
    joinedAt: p.joinedAt ? Number(p.joinedAt.seconds) * 1000 : 0,
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
  onLeft,
  children,
}: {
  call: Call;
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
  } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();
  const dominantSpeaker = useDominantSpeaker();
  const mic = useMicrophoneState({ optimisticUpdates: true });
  const camera = useCameraState({ optimisticUpdates: true });
  const speaker = useSpeakerState();
  const screenShare = useScreenShareState({ optimisticUpdates: true });

  // Why the call is closing, noted by the events that close it.
  const leaveReason = useRef<LeaveReason | null>(null);
  const reportLeft = useEffectEvent((reason: LeaveReason) => onLeft(reason));

  useEffect(() => {
    const offEnded = call.on("call.ended", (event) => {
      leaveReason.current ??= /duration/i.test(event.reason ?? "")
        ? "timeLimit"
        : "ended";
    });
    const offKicked = call.on("call.kicked_user", (event) => {
      if (event.user.id === call.currentUserId) {
        leaveReason.current ??= "removed";
      }
    });
    return () => {
      offEnded();
      offKicked();
    };
  }, [call]);

  useEffect(() => {
    if (callingState === CallingState.LEFT) {
      reportLeft(leaveReason.current ?? "left");
    } else if (callingState === CallingState.RECONNECTING_FAILED) {
      reportLeft("connectionLost");
    }
  }, [callingState]);

  const media = useMemo<RoomMedia>(
    () => ({
      status: statusOf(callingState),
      participants: participants.map(toRoomParticipant),
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
      leave: async () => {
        leaveReason.current = "left";
        await call.leave();
      },
    }),
    [
      call,
      callingState,
      participants,
      dominantSpeaker,
      mic,
      camera,
      speaker,
      screenShare,
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
