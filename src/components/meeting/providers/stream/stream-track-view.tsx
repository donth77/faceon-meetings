"use client";

import { useCallStateHooks, Video } from "@stream-io/video-react-sdk";
import { cn } from "cn";

import { usePreferences, withDefaults } from "@/lib/preferences";

import type { TrackViewProps } from "../../media";

/**
 * Renders a participant's camera or screen share with Stream's video element, styled
 * by us (the SDK's own stylesheet isn't loaded): self-view mirrored, hidden until playing.
 */
export function StreamTrackView({
  participant,
  kind,
  className,
}: TrackViewProps) {
  const { useParticipants } = useCallStateHooks();
  const { mirrorVideo } = withDefaults(usePreferences());
  const streamParticipant = useParticipants().find(
    (p) => p.sessionId === participant.key,
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
