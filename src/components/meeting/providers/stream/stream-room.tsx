"use client";

import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type Call,
} from "@stream-io/video-react-sdk";
import { useEffect, useEffectEvent, useState } from "react";

import type { DevicePreferences } from "@/lib/device/preferences";
import { loadPreferences, withDefaults } from "@/lib/preferences";
import { CALL_TYPE } from "@/lib/stream/constants";

import type { RoomAdapterProps } from "../../media";
import { StreamMedia } from "./stream-media";

type Room = { client: StreamVideoClient; call: Call; joinedAt: number };

const HD = { width: 1280, height: 720 };
const SD = { width: 640, height: 360 };

/**
 * Settings → Audio and Video first, then the remembered devices (a missing one falls
 * back to the default), then each on or off.
 */
async function applyDevices(call: Call, devices: DevicePreferences) {
  const settings = withDefaults(loadPreferences());
  call.microphone.setDefaultConstraints({
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: settings.noiseSuppression,
  });
  await Promise.allSettled([
    call.camera.selectTargetResolution(settings.hdVideo ? HD : SD),
  ]);
  await Promise.allSettled([
    devices.cameraId ? call.camera.select(devices.cameraId) : null,
    devices.micId ? call.microphone.select(devices.micId) : null,
  ]);
  if (devices.speakerId) call.speaker.select(devices.speakerId);
  // A device that fails to start leaves the call joined with it off; the room shows why.
  await Promise.allSettled([
    devices.cameraOn ? call.camera.enable() : call.camera.disable(),
    devices.micOn ? call.microphone.enable() : call.microphone.disable(),
  ]);
}

/** The Stream adapter's room: connects, joins the session's call, and provides room media. */
export default function StreamRoom(props: RoomAdapterProps) {
  // The connection and starting devices set up the room once; a new admission remounts it.
  const [setup] = useState(() => ({
    connection: props.connection,
    self: props.self,
    devices: props.devices,
  }));
  const [room, setRoom] = useState<Room>();
  const refreshToken = useEffectEvent(() => props.refreshToken());
  const leftUnexpectedly = useEffectEvent(() => props.onLeft("connectionLost"));

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
        await applyDevices(call, setup.devices);
        await call.join();
        if (!cancelled) setRoom({ client, call, joinedAt: Date.now() });
      })().catch(() => {
        if (!cancelled) leftUnexpectedly();
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
