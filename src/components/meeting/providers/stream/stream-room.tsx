"use client";

import {
  SfuJoinError,
  SfuModels,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type Call,
} from "@stream-io/video-react-sdk";
import { useEffect, useEffectEvent, useState } from "react";

import type { DevicePreferences } from "@/lib/device/preferences";
import type { CameraProcessor, MicrophoneProcessor } from "@/lib/media/types";
import { loadPreferences, withDefaults } from "@/lib/preferences";
import { CAMERA } from "@/lib/stream/call-settings";
import { CALL_TYPE } from "@/lib/stream/constants";

import type { RoomAdapterProps } from "../../media";
import { setCameraProcessor, setMicrophoneProcessor } from "./processors";
import { StreamMedia } from "./stream-media";

type Room = { client: StreamVideoClient; call: Call; joinedAt: number };
type Resolution = { width: number; height: number };

const HD = { width: 1280, height: 720 };
const SD = { width: 640, height: 360 };

/**
 * Joining sets the camera to the call type's resolution (call-settings.ts), restarting
 * one already running at another. So the camera starts before joining only at that
 * resolution, and otherwise once the call is joined, at its own.
 */
const startsBeforeJoining = (target: Resolution) =>
  target.width === CAMERA.width && target.height === CAMERA.height;

/**
 * Settings → Audio and Video first, then the remembered devices (a missing one falls
 * back to the default), then the camera's effect and the microphone's noise
 * suppression, then each on or off. Returns the camera's resolution if it's still to
 * start once the call is joined.
 */
async function applyDevices(
  call: Call,
  devices: DevicePreferences,
  start: {
    cameraProcessor: CameraProcessor | undefined;
    browserNoiseSuppression: boolean;
    microphoneProcessor: MicrophoneProcessor | undefined;
  },
): Promise<Resolution | null> {
  const settings = withDefaults(loadPreferences());
  const resolution = settings.hdVideo ? HD : SD;
  call.microphone.setDefaultConstraints({
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: start.browserNoiseSuppression,
  });
  await Promise.allSettled([call.camera.selectTargetResolution(resolution)]);
  await Promise.allSettled([
    devices.cameraId ? call.camera.select(devices.cameraId) : null,
    devices.micId ? call.microphone.select(devices.micId) : null,
  ]);
  if (devices.speakerId) call.speaker.select(devices.speakerId);
  // Before the camera starts, so the unprocessed picture is never sent.
  if (start.cameraProcessor) {
    await setCameraProcessor(call, start.cameraProcessor);
  }
  // Before the microphone starts, so it doesn't restart a moment after joining.
  if (start.microphoneProcessor) {
    await setMicrophoneProcessor(call, start.microphoneProcessor);
  }
  // A device that fails to start leaves the call joined with it off; the room shows why.
  // Turned off rather than left alone, a camera isn't started by the call type's defaults
  // as the call is joined.
  const cameraNow = devices.cameraOn && startsBeforeJoining(resolution);
  await Promise.allSettled([
    cameraNow ? call.camera.enable() : call.camera.disable(),
    devices.micOn ? call.microphone.enable() : call.microphone.disable(),
  ]);
  return devices.cameraOn && !cameraNow ? resolution : null;
}

/**
 * Stream turned the join away because the call is at its participant cap: two people
 * took the last seat at once, and our check let both through. Stream says so with an
 * SfuJoinError, code 301 (CALL_PARTICIPANT_LIMIT_REACHED), after which it won't retry.
 */
function isCallFull(error: unknown): boolean {
  return (
    error instanceof SfuJoinError &&
    error.errorEvent.error?.code ===
      SfuModels.ErrorCode.CALL_PARTICIPANT_LIMIT_REACHED
  );
}

/** The Stream adapter's room: connects, joins the session's call, and provides room media. */
export default function StreamRoom(props: RoomAdapterProps) {
  // The connection and starting devices set up the room once; a new admission remounts it.
  const [setup] = useState(() => ({
    connection: props.connection,
    self: props.self,
    devices: props.devices,
    cameraProcessor: props.cameraProcessor,
    browserNoiseSuppression: props.browserNoiseSuppression,
    microphoneProcessor: props.microphoneProcessor,
  }));
  const [room, setRoom] = useState<Room>();
  const refreshToken = useEffectEvent(() => props.refreshToken());
  const leftUnexpectedly = useEffectEvent(() => props.onLeft("connectionLost"));
  const turnedAway = useEffectEvent(() => props.onLeft("full"));

  useEffect(() => {
    let cancelled = false;
    let joined: { client: StreamVideoClient; call: Call } | undefined;

    // Start on the next tick. React's development double run mounts, unmounts and
    // mounts again at once; only the mount that stays gets this far, so the call never
    // sees two of you for a moment.
    const start = setTimeout(() => {
      const client = new StreamVideoClient({
        apiKey: setup.connection.endpoint,
        user: setup.self,
        token: setup.connection.token,
        tokenProvider: () => refreshToken(),
      });
      const call = client.call(CALL_TYPE, setup.connection.room);
      joined = { client, call };
      (async () => {
        const cameraLater = await applyDevices(call, setup.devices, setup);
        await call.join();
        if (cancelled) return;
        if (cameraLater) {
          // Joining set the call type's resolution: this camera's comes back first.
          await call.camera.selectTargetResolution(cameraLater).catch(() => {});
          void call.camera.enable().catch(() => {});
        }
        setRoom({ client, call, joinedAt: Date.now() });
      })().catch((error: unknown) => {
        if (cancelled) return;
        if (isCallFull(error)) turnedAway();
        else leftUnexpectedly();
      });
    }, 0);

    // Create, join and tear down in one effect, so a remount never reuses a
    // disconnected client.
    return () => {
      cancelled = true;
      clearTimeout(start);
      setRoom(undefined);
      if (!joined) return;
      const { client, call } = joined;
      void call
        .leave()
        .catch(() => {}) // already left or ended
        .finally(() => client.disconnectUser());
    };
  }, [setup]);

  if (!room) return props.fallback;
  return (
    <StreamVideo client={room.client}>
      <StreamCall call={room.call}>
        <StreamMedia
          call={room.call}
          joinedAt={room.joinedAt}
          onLeft={props.onLeft}
        >
          {props.children}
        </StreamMedia>
      </StreamCall>
    </StreamVideo>
  );
}
