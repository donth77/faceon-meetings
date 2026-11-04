"use client";

import {
  hasPausedTrack,
  hasScreenShare,
  hasVideo,
  useCall,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { cn } from "cn";
import {
  useCallback,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
} from "react";

import { usePreferences, withDefaults } from "@/lib/preferences";

import type { TrackViewProps } from "../../media";
import { showVideo } from "./video-views";

/** Whether the video element would show the same thing for both. */
const sameVideo = (a: StreamVideoParticipant, b: StreamVideoParticipant) =>
  a.sessionId === b.sessionId &&
  a.isLocalParticipant === b.isLocalParticipant &&
  a.videoStream === b.videoStream &&
  a.screenShareStream === b.screenShareStream &&
  a.publishedTracks === b.publishedTracks &&
  a.pausedTracks === b.pausedTracks;

/**
 * Renders a participant's camera or screen share in a video element of our own, which
 * video-views.ts hands to Stream or shows the same stream in (Stream's own element binds
 * every copy, so a second one would cut the first off): self-view mirrored, hidden until
 * playing. It follows just this participant, and only what the video uses, so a voice
 * level changing many times a second doesn't redraw it.
 */
export function StreamTrackView({
  participant,
  kind,
  className,
  onAspectRatio,
}: TrackViewProps) {
  const call = useCall();
  const { mirrorVideo } = withDefaults(usePreferences());
  const trackType = kind === "screen" ? "screenShareTrack" : "videoTrack";
  const sessionId = participant.key;
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
    () => (call ? select(call.state.participants, sessionId) : undefined),
    () => undefined,
  );
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  // The element now playing, so a new one starts hidden.
  const [playing, setPlaying] = useState<HTMLVideoElement | null>(null);

  useLayoutEffect(() => {
    if (!call || !element) return;
    return showVideo(call, element, sessionId, trackType);
  }, [call, element, sessionId, trackType]);

  if (!call || !streamParticipant) return null;
  const shown = playing !== null && playing === element;
  const publishing =
    kind === "screen"
      ? hasScreenShare(streamParticipant)
      : hasVideo(streamParticipant);
  // Paused by the media server to save bandwidth: nothing to show until it resumes.
  if (!publishing || hasPausedTrack(streamParticipant, trackType)) return null;
  // Stream mirrors your front camera; Settings → Video can turn that off.
  const mirror =
    kind === "video" && streamParticipant.isLocalParticipant && mirrorVideo;
  // The picture's shape, when it first loads and whenever it changes (a rotated phone,
  // a resized shared window).
  const reportShape = onAspectRatio
    ? (event: SyntheticEvent<HTMLVideoElement>) => {
        const { videoWidth, videoHeight } = event.currentTarget;
        if (videoWidth > 0 && videoHeight > 0) {
          onAspectRatio(videoWidth / videoHeight);
        }
      }
    : undefined;

  return (
    <video
      ref={setElement}
      autoPlay
      playsInline
      muted
      onPlaying={(event) => setPlaying(event.currentTarget)}
      onPause={() => setPlaying(null)}
      onEmptied={() => setPlaying(null)}
      onLoadedMetadata={reportShape}
      onResize={reportShape}
      className={cn(
        "transition-opacity duration-200",
        mirror && "-scale-x-100",
        !shown && "opacity-0",
        className,
      )}
    />
  );
}
