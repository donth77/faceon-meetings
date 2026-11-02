"use client";

import {
  CallingState,
  hasAudio,
  hasScreenShare,
  hasVideo,
  OwnCapability,
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
  useState,
  type ReactNode,
} from "react";

import { deviceProblem } from "@/lib/device/problems";
import {
  isReactionCode,
  RoomEvent,
  SharedSessionState,
} from "@/lib/meetings/events";
import { canChooseSpeaker } from "@/lib/platform";
import { createReuser } from "@/lib/reuse";

import {
  RoomMediaProvider,
  type ConnectionQuality,
  type LeaveReason,
  type RoomMedia,
  type RoomParticipant,
  type RoomStatus,
  type ShareOptions,
} from "../../media";
import { setCameraProcessor } from "./camera-processor";
import { StreamTrackView } from "./stream-track-view";

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
    joinedAt: joinedAt > 0 ? joinedAt - clockSkew : 0,
    audio: hasAudio(p),
    video: hasVideo(p),
    screen: hasScreenShare(p),
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

/** Chrome's picker hints, which TypeScript's DOM types don't list yet. */
type DisplayMediaHints = DisplayMediaStreamOptions & {
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
};

/**
 * Shares the screen with the menu's choices: which list the browser's picker opens on,
 * whether sound comes along, and smooth motion or sharp text.
 */
async function startScreenShare(call: Call, options: ShareOptions) {
  const manager = call.screenShare;
  if (options.audio) manager.enableScreenShareAudio();
  else await manager.disableScreenShareAudio();
  manager.setSettings({
    contentHint: options.motion ? "motion" : "detail",
    maxFramerate: options.motion ? 30 : 15,
  });
  const current = manager.state.defaultConstraints ?? {};
  const video = typeof current.video === "object" ? { ...current.video } : {};
  delete video.displaySurface;
  const constraints: DisplayMediaHints = {
    ...current,
    video: options.surface
      ? { ...video, displaySurface: options.surface }
      : video,
    // Leave FaceOn's own tab out of the picker (no hall of mirrors), and offer Chrome's
    // "Share this tab instead".
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
  };
  manager.setDefaultConstraints(constraints);
  await manager.enable();
}

/** Noise suppression on the live microphone, and on any it restarts with. */
async function setNoiseSuppression(call: Call, on: boolean) {
  call.microphone.setDefaultConstraints({
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: on,
  });
  const track = call.microphone.state.mediaStream?.getAudioTracks()[0];
  await track?.applyConstraints({
    ...track.getConstraints(),
    noiseSuppression: on,
  });
}

const firstTrack = (stream: MediaStream | undefined, kind: "audio" | "video") =>
  (kind === "audio"
    ? stream?.getAudioTracks()
    : stream?.getVideoTracks())?.[0] ?? null;

/** Whether two of Stream's participants would play the same audio. */
const sameAudio = (a: StreamVideoParticipant, b: StreamVideoParticipant) =>
  a.userId === b.userId &&
  a.isLocalParticipant === b.isLocalParticipant &&
  a.audioStream === b.audioStream &&
  a.screenShareAudioStream === b.screenShareAudioStream;

/**
 * Maps Stream's call state onto room media for the UI, and plays everyone else's audio.
 * Stream's participant list changes with every audio level, many times a second; room
 * media changes only when something the room shows does, so the room doesn't redraw.
 */
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
    useMicrophoneState,
    useCameraState,
    useSpeakerState,
    useScreenShareState,
    useCallCustomData,
    useHasPermissions,
  } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();
  // Stream's state hooks return a new object on every render; only these values matter.
  const {
    microphone,
    optionsAwareIsMute: micMuted,
    mediaStream: micStream,
    isSpeakingWhileMuted,
    error: micError,
    devices: micDevices,
    selectedDevice: micSelected,
  } = useMicrophoneState({ optimisticUpdates: true });
  const {
    camera: cameraManager,
    optionsAwareIsMute: cameraMuted,
    mediaStream: cameraStream,
    error: cameraError,
    devices: cameraDevices,
    selectedDevice: cameraSelected,
  } = useCameraState({ optimisticUpdates: true });
  const {
    speaker: speakerManager,
    isDeviceSelectionSupported,
    devices: speakerDevices,
    selectedDevice: speakerSelected,
  } = useSpeakerState();
  const { screenShare: screenShareManager, optionsAwareIsMute: notSharing } =
    useScreenShareState({ optimisticUpdates: true });
  // Hosts' policies revoke these; Stream stops the track when one is taken away.
  const canSendAudio = useHasPermissions(OwnCapability.SEND_AUDIO);
  const canSendVideo = useHasPermissions(OwnCapability.SEND_VIDEO);
  const canShare = useHasPermissions(OwnCapability.SCREENSHARE);
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
      | "subscribeHostMutes"
      | "speakingOf"
      | "audioLevelOf"
      | "dominantSpeakerOf"
      | "subscribeVoices"
    >
  >(
    () => ({
      leave: async () => {
        leaveReason.current = "left";
        // A second Leave (or one after the call ended) has nothing left to do.
        if (call.state.callingState === CallingState.LEFT) return;
        await call.leave().catch(() => {
          // Leaving failed; the room stays, and Leave can be pressed again.
        });
      },
      sendEvent: async (event) => {
        await call.sendCustomEvent(event);
      },
      subscribeEvents: (handler) =>
        call.on("custom", (event) => {
          const parsed = RoomEvent.safeParse(event.custom);
          if (!parsed.success) return;
          // Our server sends as its own user, the only one with Stream's admin role.
          // Only server-side code can give a user that role.
          if (event.user.role === "admin") {
            handler(parsed.data, null);
            return;
          }
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
      speakingOf: (key) =>
        call.state.participants.find((p) => p.sessionId === key)?.isSpeaking ??
        false,
      audioLevelOf: (key) =>
        call.state.participants.find((p) => p.sessionId === key)?.audioLevel ??
        0,
      dominantSpeakerOf: () => call.state.dominantSpeaker?.sessionId,
      // Stream works out the dominant speaker from the participant list too.
      subscribeVoices: (onChange) => {
        const subscription = call.state.participants$.subscribe(() =>
          onChange(),
        );
        return () => subscription.unsubscribe();
      },
      subscribeHostMutes: (handler) =>
        call.on("trackUnpublished", (event) => {
          const self = call.state.localParticipant;
          if (
            event.cause !== SfuModels.TrackUnpublishReason.MODERATION ||
            !self ||
            event.sessionId !== self.sessionId
          ) {
            return;
          }
          const { TrackType } = SfuModels;
          if (event.type === TrackType.AUDIO) handler("audio");
          else if (event.type === TrackType.VIDEO) handler("video");
          else if (event.type === TrackType.SCREEN_SHARE) handler("screen");
        }),
    }),
    [call],
  );

  // The same participant objects, and list, until something shown about them changes.
  const [reuseParticipants] = useState(() =>
    createReuser<RoomParticipant>((p) => p.key),
  );
  const roomParticipants = useMemo(
    () =>
      reuseParticipants(
        participants.map((p) => toRoomParticipant(p, clockSkew)),
      ),
    [participants, clockSkew, reuseParticipants],
  );
  const [reuseRemote] = useState(() =>
    createReuser<StreamVideoParticipant>((p) => p.sessionId, sameAudio),
  );
  const remote = useMemo(
    () => reuseRemote(participants.filter((p) => !p.isLocalParticipant)),
    [participants, reuseRemote],
  );

  const mic = useMemo<RoomMedia["mic"]>(
    () => ({
      enabled: !micMuted,
      track: micMuted ? null : firstTrack(micStream, "audio"),
      speakingWhileMuted: isSpeakingWhileMuted,
      setNoiseSuppression: (on) => setNoiseSuppression(call, on),
      allowed: canSendAudio,
      problem: micError ? deviceProblem(micError) : null,
      devices: micDevices,
      selectedId: micSelected,
      toggle: () => microphone.toggle(),
      select: (deviceId) => microphone.select(deviceId),
    }),
    [
      call,
      canSendAudio,
      isSpeakingWhileMuted,
      micDevices,
      micError,
      micMuted,
      micSelected,
      micStream,
      microphone,
    ],
  );
  const camera = useMemo<RoomMedia["camera"]>(
    () => ({
      enabled: !cameraMuted,
      track: cameraMuted ? null : firstTrack(cameraStream, "video"),
      allowed: canSendVideo,
      problem: cameraError ? deviceProblem(cameraError) : null,
      devices: cameraDevices,
      selectedId: cameraSelected,
      toggle: () => cameraManager.toggle(),
      select: (deviceId) => cameraManager.select(deviceId),
      flip: () => cameraManager.flip(),
      setProcessor: (processor) => setCameraProcessor(call, processor),
    }),
    [
      call,
      cameraDevices,
      cameraError,
      cameraManager,
      cameraMuted,
      cameraSelected,
      cameraStream,
      canSendVideo,
    ],
  );
  const speaker = useMemo<RoomMedia["speaker"]>(
    () => ({
      supported: isDeviceSelectionSupported && canChooseSpeaker(),
      devices: speakerDevices,
      selectedId: speakerSelected || undefined,
      select: (deviceId) => speakerManager.select(deviceId),
    }),
    [
      isDeviceSelectionSupported,
      speakerDevices,
      speakerManager,
      speakerSelected,
    ],
  );
  const screenShare = useMemo<RoomMedia["screenShare"]>(
    () => ({
      enabled: !notSharing,
      allowed: canShare,
      start: (options) => startScreenShare(call, options),
      stop: () => screenShareManager.disable(),
    }),
    [call, canShare, notSharing, screenShareManager],
  );

  const media = useMemo<RoomMedia>(
    () => ({
      status: statusOf(callingState),
      sessionState,
      participants: roomParticipants,
      mic,
      camera,
      speaker,
      screenShare,
      ...actions,
    }),
    [
      actions,
      callingState,
      camera,
      mic,
      roomParticipants,
      screenShare,
      sessionState,
      speaker,
    ],
  );
  const value = useMemo(() => ({ media, TrackView: StreamTrackView }), [media]);

  return (
    <RoomMediaProvider value={value}>
      <ParticipantsAudio participants={remote} />
      {children}
    </RoomMediaProvider>
  );
}
