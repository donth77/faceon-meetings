import type { Call, VideoTrackType } from "@stream-io/video-react-sdk";

import {
  videoRequest,
  type Size,
  type VideoView,
} from "@/lib/media/video-views";

type View = VideoView & { element: HTMLVideoElement };

/** One participant's camera or screen, wherever it shows. */
type Video = {
  call: Call;
  sessionId: string;
  trackType: VideoTrackType;
  /** Your own video: nothing to ask the media server for. */
  local: boolean;
  views: Set<View>;
  /** The view Stream has, and what takes it back. */
  bound: { view: View; unbind: () => void } | null;
  /** The size last asked for. */
  asked: Size | null;
  stopFollowing: () => void;
};

/** Each call's videos, by session and track. */
const videos = new WeakMap<Call, Map<string, Video>>();

const sameSize = (a: Size | null, b: Size | null) =>
  a === b || (!!a && !!b && a.width === b.width && a.height === b.height);

/**
 * Asks Stream for a camera at this size, in place of its own (the bound element's, in
 * CSS pixels); null takes the request back. Stream takes a size of its own only for
 * cameras: a screen is asked for at its view's size.
 */
function ask(video: Video, size: Size | null) {
  if (video.local || video.trackType !== "videoTrack") return;
  if (sameSize(video.asked, size)) return;
  video.asked = size;
  video.call.setPreferredIncomingVideoResolution(size ?? undefined, [
    video.sessionId,
  ]);
}

/** The views Stream doesn't have show the same stream. */
function follow(video: Video) {
  const participant = video.call.state.findParticipantBySessionId(
    video.sessionId,
  );
  const stream =
    (video.trackType === "screenShareTrack"
      ? participant?.screenShareStream
      : participant?.videoStream) ?? null;
  for (const view of video.views) {
    if (view === video.bound?.view || view.element.srcObject === stream) {
      continue;
    }
    view.element.srcObject = stream;
    if (stream) void view.element.play().catch(() => {});
  }
}

/**
 * Hands Stream the view that should have the video, asking for the size the views need
 * first: Stream asks the media server soon after a binding changes, and a size set
 * after that would hold its request back by a second.
 */
function update(video: Video) {
  const request = videoRequest(video.views, video.bound?.view ?? null);
  ask(video, request?.size ?? null);
  const next = request?.view ?? null;
  if (video.bound?.view !== next) {
    const previous = video.bound;
    video.bound = null;
    previous?.unbind();
    const unbind = next
      ? video.call.bindVideoElement(
          next.element,
          video.sessionId,
          video.trackType,
        )
      : undefined;
    if (next && unbind) video.bound = { view: next, unbind };
  }
  follow(video);
}

/**
 * Shows a participant's camera or screen in `element`. Stream keeps one requested size
 * per participant and track, and stops sending it when any element it was given goes,
 * so only one element per video is handed to Stream (the largest on screen), and the
 * others show the same stream: closing the picture-in-picture window leaves the stage
 * playing. The size asked for is what the views need in device pixels, the smallest
 * while their page is in the background; a video scrolled out of sight isn't sent at
 * all. Returns what stops showing it.
 */
export function showVideo(
  call: Call,
  element: HTMLVideoElement,
  sessionId: string,
  trackType: VideoTrackType,
): () => void {
  let calls = videos.get(call);
  if (!calls) {
    calls = new Map();
    videos.set(call, calls);
  }
  const key = `${sessionId}:${trackType}`;
  let video = calls.get(key);
  if (!video) {
    const created: Video = {
      call,
      sessionId,
      trackType,
      local:
        call.state.findParticipantBySessionId(sessionId)?.isLocalParticipant ===
        true,
      views: new Set(),
      bound: null,
      asked: null,
      stopFollowing: () => {},
    };
    // Stream replaces a participant's stream as tracks come and go.
    const subscription = call.state.participants$.subscribe(() =>
      follow(created),
    );
    created.stopFollowing = () => subscription.unsubscribe();
    calls.set(key, created);
    video = created;
  }
  const current = video;
  const known = calls;

  // The picture-in-picture window is a page of its own: watch the element from there.
  const page = element.ownerDocument;
  const frame = page.defaultView ?? window;
  element.autoplay = true;
  element.playsInline = true;
  element.muted = true;
  const view: View = {
    element,
    onScreen: true,
    pageShown: !page.hidden,
    width: element.clientWidth,
    height: element.clientHeight,
    pixelRatio: frame.devicePixelRatio || 1,
  };
  current.views.add(view);

  // Made before Stream's own observer, which comes with a binding, so in each frame
  // Stream asks the media server after this size is set.
  const resizes = new frame.ResizeObserver(() => {
    view.width = element.clientWidth;
    view.height = element.clientHeight;
    view.pixelRatio = frame.devicePixelRatio || 1;
    update(current);
  });
  resizes.observe(element);
  const sightings = new frame.IntersectionObserver(
    (entries) => {
      const entry = entries.at(-1);
      if (!entry || entry.isIntersecting === view.onScreen) return;
      view.onScreen = entry.isIntersecting;
      update(current);
    },
    { threshold: 0 },
  );
  sightings.observe(element);
  const pageChanged = () => {
    view.pageShown = !page.hidden;
    update(current);
  };
  page.addEventListener("visibilitychange", pageChanged);
  update(current);

  return () => {
    resizes.disconnect();
    sightings.disconnect();
    page.removeEventListener("visibilitychange", pageChanged);
    current.views.delete(view);
    if (current.views.size === 0) {
      known.delete(key);
      current.stopFollowing();
    }
    update(current);
    element.srcObject = null;
  };
}
