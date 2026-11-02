"use client";

import {
  useCall,
  Video,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { cn } from "cn";
import { useCallback, useState, useSyncExternalStore } from "react";

import { usePreferences, withDefaults } from "@/lib/preferences";

import type { TrackViewProps } from "../../media";

/** Whether Stream's video element would show the same thing for both. */
const sameVideo = (a: StreamVideoParticipant, b: StreamVideoParticipant) =>
  a.sessionId === b.sessionId &&
  a.userId === b.userId &&
  a.isLocalParticipant === b.isLocalParticipant &&
  a.videoStream === b.videoStream &&
  a.screenShareStream === b.screenShareStream &&
  a.publishedTracks === b.publishedTracks &&
  a.pausedTracks === b.pausedTracks &&
  a.viewportVisibilityState === b.viewportVisibilityState;

/**
 * Renders a participant's camera or screen share with Stream's video element, styled
 * by us (the SDK's own stylesheet isn't loaded): self-view mirrored, hidden until playing.
 * It follows just this participant, and only what the video element uses, so a voice
 * level changing many times a second doesn't redraw it.
 */
export function StreamTrackView({
  participant,
  kind,
  className,
}: TrackViewProps) {
  const call = useCall();
  const { mirrorVideo } = withDefaults(usePreferences());
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = call?.state.participants$.subscribe(() =>
        onChange(),
      );
      return () => subscription?.unsubscribe();
    },
    [call],
  );
  // The participant last shown, kept while nothing the video uses has changed.
  const [select] = useState(() => {
    let shown: StreamVideoParticipant | undefined;
    return (all: StreamVideoParticipant[], key: string) => {
      const next = all.find((p) => p.sessionId === key);
      if (!(shown && next && sameVideo(shown, next))) shown = next;
      return shown;
    };
  });
  const streamParticipant = useSyncExternalStore(
    subscribe,
    () => (call ? select(call.state.participants, participant.key) : undefined),
    () => undefined,
  );
  if (!streamParticipant) return null;

  return (
    <Video
      participant={streamParticipant}
      trackType={kind === "screen" ? "screenShareTrack" : "videoTrack"}
      // Stream mirrors your front camera; Settings → Video can turn that off.
      mirror={kind === "video" && !mirrorVideo ? false : undefined}
      VideoPlaceholder={null}
      PictureInPicturePlaceholder={null}
      className={cn(
        "transition-opacity duration-200 [&.str-video__video--mirror]:-scale-x-100 [&.str-video__video--not-playing]:opacity-0",
        className,
      )}
    />
  );
}
