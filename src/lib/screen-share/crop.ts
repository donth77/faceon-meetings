import { cropRect, type Area } from "./area";

/** Chromium's track processor and generator, which aren't in TypeScript's DOM types. */
type Insertable = {
  MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => {
    readable: ReadableStream<VideoFrame>;
  };
  MediaStreamTrackGenerator?: new (init: {
    kind: "video";
  }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> };
};

/** A screen capture cropped to an area, as a track of its own. */
export type CroppedScreen = {
  /** Only the area's pixels: what's sent. */
  track: MediaStreamTrack;
  /** Moves the area; the next frame is cropped to it. */
  setArea: (area: Area) => void;
  stop: () => void;
};

/**
 * Crops each frame of a screen capture to `area` and makes a new track of them, so only
 * that part of the screen is ever sent. Frames are re-wrapped with a smaller visible
 * rectangle, not redrawn, so cropping costs next to nothing. A frame that can't be
 * cropped is dropped, never sent whole. `onEnded` runs once, when the capture ends (its
 * owner stopped it from the browser's bar, or `stop`).
 */
export function cropScreen(
  screen: MediaStreamTrack,
  area: Area,
  onEnded: () => void,
): CroppedScreen {
  const api = globalThis as Insertable;
  if (!api.MediaStreamTrackProcessor || !api.MediaStreamTrackGenerator) {
    throw new Error("Track processors aren't available.");
  }
  const reader = new api.MediaStreamTrackProcessor({
    track: screen,
  }).readable.getReader();
  const generator = new api.MediaStreamTrackGenerator({ kind: "video" });
  generator.contentHint = screen.contentHint;
  const writer = generator.writable.getWriter();
  let current = area;
  let running = true;
  let reading = false;

  void (async () => {
    while (running) {
      reading = true;
      const next = await reader.read().catch(() => null);
      reading = false;
      if (!next || next.done) break;
      const frame = next.value;
      let cropped: VideoFrame | undefined;
      try {
        const whole = frame.visibleRect;
        if (running && whole) {
          const rect = cropRect(current, whole.width, whole.height);
          cropped = new VideoFrame(frame, {
            visibleRect: {
              x: whole.x + rect.x,
              y: whole.y + rect.y,
              width: rect.width,
              height: rect.height,
            },
          });
          // The generator takes the frame (and closes it) once written.
          await writer.write(cropped);
          cropped = undefined;
        }
      } catch {
        // A frame that couldn't be cropped, or stopped while writing: nothing went.
        if (!running) break;
      } finally {
        cropped?.close();
        frame.close();
      }
    }
    running = false;
    await reader.cancel().catch(() => {});
    void writer.close().catch(() => {});
    generator.stop();
    onEnded();
  })();

  return {
    track: generator,
    setArea(next) {
      current = next;
    },
    stop() {
      if (!running) return;
      running = false;
      screen.stop();
      generator.stop();
      // Waiting for a frame that may never come: stop waiting. A frame in hand is closed
      // by the loop instead.
      if (reading) void reader.cancel().catch(() => {});
    },
  };
}
