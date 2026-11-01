"use client";

import { lazy, Suspense, type ComponentType } from "react";

import type { MediaProviderId } from "@/lib/media/types";

import type { RoomAdapterProps } from "../media";

/**
 * Each provider's room loads only when a session on that provider is joined, so a
 * meeting downloads one media SDK and the dashboard downloads none.
 */
const ADAPTERS: Partial<
  Record<MediaProviderId, ComponentType<RoomAdapterProps>>
> = {
  stream: lazy(() => import("../providers/stream/stream-room")),
};

export function MeetingRoom(props: RoomAdapterProps) {
  const Adapter = ADAPTERS[props.connection.provider];
  if (!Adapter) {
    throw new Error(
      `No meeting client for provider "${props.connection.provider}".`,
    );
  }
  return (
    <Suspense fallback={props.fallback}>
      <Adapter {...props} />
    </Suspense>
  );
}
