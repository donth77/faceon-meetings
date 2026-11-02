"use client";

import { lazy, Suspense, type ComponentType } from "react";

import type { MediaProviderId } from "@/lib/media/types";
import { browserSuppression } from "@/lib/noise/noise";

import type { RoomAdapterProps } from "../media";
import { RoomEffectsProvider, useNewRoomEffects } from "./room-effects";
import { RoomNoiseProvider, useNewRoomNoise } from "./room-noise";

/**
 * Each provider's room loads only when a session on that provider is joined, so a
 * meeting downloads one media SDK and the dashboard downloads none.
 */
const ADAPTERS: Partial<
  Record<MediaProviderId, ComponentType<RoomAdapterProps>>
> = {
  stream: lazy(() => import("../providers/stream/stream-room")),
};

export function MeetingRoom(
  props: Omit<
    RoomAdapterProps,
    "cameraProcessor" | "browserNoiseSuppression" | "microphoneProcessor"
  >,
) {
  // The saved background goes on before the camera sends anything, and the saved noise
  // suppression before the microphone does.
  const effects = useNewRoomEffects();
  const noise = useNewRoomNoise();
  const Adapter = ADAPTERS[props.connection.provider];
  if (!Adapter) {
    throw new Error(
      `No meeting client for provider "${props.connection.provider}".`,
    );
  }
  return (
    <RoomEffectsProvider value={effects}>
      <RoomNoiseProvider value={noise}>
        <Suspense fallback={props.fallback}>
          <Adapter
            {...props}
            cameraProcessor={
              effects.startedWith ? effects.camera.processor : undefined
            }
            browserNoiseSuppression={browserSuppression(noise.startedWith)}
            microphoneProcessor={
              noise.startedWith === "strong" ? noise.processor : undefined
            }
          />
        </Suspense>
      </RoomNoiseProvider>
    </RoomEffectsProvider>
  );
}
