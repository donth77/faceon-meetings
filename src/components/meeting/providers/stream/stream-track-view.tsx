"use client";

import { useCallStateHooks, Video } from "@stream-io/video-react-sdk";
import { cn } from "cn";

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
  const streamParticipant = useParticipants().find(
    (p) => p.sessionId === participant.key,
  );
  if (!streamParticipant) return null;

  return (
    <Video
      participant={streamParticipant}
      trackType={kind === "screen" ? "screenShareTrack" : "videoTrack"}
      VideoPlaceholder={null}
      PictureInPicturePlaceholder={null}
      className={cn(
        "transition-opacity duration-200 [&.str-video__video--mirror]:-scale-x-100 [&.str-video__video--not-playing]:opacity-0",
        className,
      )}
    />
  );
}
