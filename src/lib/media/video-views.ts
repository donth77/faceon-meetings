/**
 * What to ask a media server for when someone's video shows in several places at once
 * (the stage and the picture-in-picture window). Servers keep one requested size per
 * video, so one view is handed to the server and the size asked for is the largest any
 * view needs, in device pixels. Pure, so it's tested without a browser; the adapters'
 * views apply it (providers/stream/video-views.ts).
 */

export type Size = { width: number; height: number };

/** One element showing a video, as last measured. */
export type VideoView = {
  /** Some of it is on screen: not scrolled out of its strip, say. */
  onScreen: boolean;
  /** Its page is showing, not a tab in the background or a minimized window. */
  pageShown: boolean;
  /** Its size, in CSS pixels. */
  width: number;
  height: number;
  /** Its window's device pixels per CSS pixel. */
  pixelRatio: number;
};

/** What a page in the background asks for: the smallest version the server sends. */
export const BACKGROUND_SIZE: Size = { width: 160, height: 90 };

/** Device pixels count up to this many per CSS pixel; a call's video is no sharper. */
export const MAX_PIXEL_RATIO = 2;

/** Whether a view needs the video at all. */
export const needsVideo = (view: VideoView): boolean =>
  view.onScreen && view.width > 0 && view.height > 0;

/** The size one view needs, in device pixels. */
export function neededSize(view: VideoView): Size {
  if (!view.pageShown) return BACKGROUND_SIZE;
  const ratio = Math.min(Math.max(view.pixelRatio, 1), MAX_PIXEL_RATIO);
  return {
    width: Math.ceil(view.width * ratio),
    height: Math.ceil(view.height * ratio),
  };
}

/**
 * Which view to hand the server, and the size to ask for: the largest any view that
 * needs the video needs. `current` stays while it still needs the video, so the server
 * isn't handed another for nothing; otherwise the largest view takes over. Null when no
 * view needs it: then nothing need be sent.
 */
export function videoRequest<T extends VideoView>(
  views: Iterable<T>,
  current: T | null,
): { view: T; size: Size } | null {
  let largest: T | null = null;
  let largestArea = -1;
  let keepCurrent = false;
  const size: Size = { width: 0, height: 0 };
  for (const view of views) {
    if (!needsVideo(view)) continue;
    const needed = neededSize(view);
    size.width = Math.max(size.width, needed.width);
    size.height = Math.max(size.height, needed.height);
    if (view === current) keepCurrent = true;
    const area = view.width * view.height * (view.pageShown ? 1 : 0);
    if (area > largestArea) {
      largest = view;
      largestArea = area;
    }
  }
  if (!largest) return null;
  return { view: keepCurrent && current ? current : largest, size };
}
