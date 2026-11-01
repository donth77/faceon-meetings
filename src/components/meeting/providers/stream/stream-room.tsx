"use client";

import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type Call,
} from "@stream-io/video-react-sdk";
import { useEffect, useEffectEvent, useState } from "react";

import type { DevicePreferences } from "@/lib/device/preferences";
import { CALL_TYPE } from "@/lib/stream/constants";

import type { RoomAdapterProps } from "../../media";
import { StreamMedia } from "./stream-media";

type Room = { client: StreamVideoClient; call: Call };

/** Remembered devices first (a missing one falls back to the default), then on or off. */
async function applyDevices(call: Call, devices: DevicePreferences) {
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
    const client = new StreamVideoClient({
      apiKey: setup.connection.endpoint,
      user: setup.self,
      token: setup.connection.token,
      tokenProvider: () => refreshToken(),
    });
    const call = client.call(CALL_TYPE, setup.connection.room);
    let cancelled = false;

    (async () => {
      await applyDevices(call, setup.devices);
      await call.join();
      if (!cancelled) setRoom({ client, call });
    })().catch(() => {
      if (!cancelled) leftUnexpectedly();
    });

    // Create, join and tear down in one effect, so a remount (or React's development
    // double run) never reuses a disconnected client.
    return () => {
      cancelled = true;
      setRoom(undefined);
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
        <StreamMedia call={room.call} onLeft={props.onLeft}>
          {props.children}
        </StreamMedia>
      </StreamCall>
    </StreamVideo>
  );
}
