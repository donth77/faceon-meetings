import type { ImageSegmenter } from "@mediapipe/tasks-vision";

import type { Effect } from "../effects";
import { FrameBudget, MaskSmoother } from "../frame";
import { loadBackdrop, readyBackdrop, type LoadedBackdrop } from "./backdrops";
import { Compositor } from "./compositor";
import { loadSegmenter, segment } from "./segmenter";

export type EffectsEvents = {
  /** Frames kept taking too long, even finding the person every other frame. */
  onTooSlow?: () => void;
  /** Nothing can be shown: the model or the first background didn't load, or the GPU gave up. */
  onFailed?: () => void;
  /** A new background didn't load, so the one `showing` stays. */
  onBackgroundFailed?: (showing: Effect) => void;
};

export type EffectsProcessor = {
  /** The processed video. It shows nothing of the camera until an effect is drawn. */
  track: MediaStreamTrack;
  /** Changes the effect without restarting anything. */
  setEffect: (effect: Effect) => void;
  stop: () => void;
};

/** Frames per second where we pace frames ourselves (no track processors). */
const PACED_FPS = 30;
/** Past this, a frame is too slow (there's other work on the page too). */
const FRAME_BUDGET_MS = 24;

type Render = (frame: TexImageSource, width: number, height: number) => boolean;
type Output = { track: MediaStreamTrack; stop: () => void };

/** Chromium's track processor and generator, which aren't in TypeScript's DOM types. */
type Insertable = {
  MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => {
    readable: ReadableStream<VideoFrame>;
  };
  MediaStreamTrackGenerator?: new (init: {
    kind: "video";
  }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> };
};

/** Whether this browser hands us camera frames directly (Chrome, Edge). */
export const canProcessTracks = () => {
  const api = globalThis as Insertable;
  return Boolean(
    api.MediaStreamTrackProcessor && api.MediaStreamTrackGenerator,
  );
};

/**
 * Applies an effect to a camera track: MediaPipe finds the person, the compositor draws
 * them over the background, and the result is a new track. Throws when WebGL2 isn't
 * available. Until the model is ready, frames show only the background (or a full blur).
 */
export function startEffects(
  input: MediaStreamTrack,
  effect: Effect,
  events: EffectsEvents = {},
): EffectsProcessor {
  const compositor = new Compositor();
  const smoother = new MaskSmoother();
  const budget = new FrameBudget(FRAME_BUDGET_MS);
  const startedAt = performance.now();
  let segmenter: ImageSegmenter | null = null;
  let backdrop: LoadedBackdrop | null = null;
  /** The effect whose background is drawn. */
  let showing: Effect | null = null;
  let generation = 0;
  let stopped = false;
  let failed = false;
  let frames = 0;
  /** Find the person every this many frames; 2 when frames run slow. */
  let every = 1;

  function fail() {
    if (failed || stopped) return;
    failed = true;
    events.onFailed?.();
  }

  loadSegmenter().then((loaded) => {
    segmenter = loaded;
  }, fail);

  function show(next: Effect, loaded: LoadedBackdrop) {
    backdrop?.release();
    backdrop = loaded;
    showing = next;
  }

  function setEffect(next: Effect) {
    const wanted = ++generation;
    const ready = readyBackdrop(next);
    if (ready) {
      show(next, ready);
      return;
    }
    // The last background stays until the new one has loaded.
    loadBackdrop(next).then(
      (loaded) => {
        if (stopped || wanted !== generation) loaded.release();
        else show(next, loaded);
      },
      () => {
        if (stopped || wanted !== generation) return;
        if (showing) events.onBackgroundFailed?.(showing);
        else fail();
      },
    );
  }
  setEffect(effect);

  const render: Render = (frame, width, height) => {
    if (!backdrop || failed) return false;
    if (compositor.lost) {
      fail();
      return false;
    }
    const begun = performance.now();
    try {
      if (segmenter && frames % every === 0) {
        segment(segmenter, frame, (confidence, maskWidth, maskHeight) =>
          compositor.setMask(
            smoother.update(confidence),
            maskWidth,
            maskHeight,
          ),
        );
      }
      frames++;
      compositor.draw(
        frame,
        width,
        height,
        backdrop.backdrop,
        (begun - startedAt) / 1000,
      );
    } catch {
      fail();
      return false;
    }
    if (segmenter && budget.record(performance.now() - begun)) {
      if (every === 1) every = 2;
      else events.onTooSlow?.();
    }
    return true;
  };

  const output = canProcessTracks()
    ? throughTrackProcessor(input, render, compositor.canvas)
    : throughCanvas(input, render, compositor.canvas);

  return {
    track: output.track,
    setEffect,
    stop() {
      if (stopped) return;
      stopped = true;
      output.stop();
      backdrop?.release();
      compositor.dispose();
    },
  };
}

/** Chrome and Edge: camera frames in, processed frames out, background tab or not. */
function throughTrackProcessor(
  input: MediaStreamTrack,
  render: Render,
  canvas: HTMLCanvasElement,
): Output {
  const api = globalThis as Insertable;
  if (!api.MediaStreamTrackProcessor || !api.MediaStreamTrackGenerator) {
    throw new Error("Track processors aren't available.");
  }
  const reader = new api.MediaStreamTrackProcessor({
    track: input,
  }).readable.getReader();
  const generator = new api.MediaStreamTrackGenerator({ kind: "video" });
  const writer = generator.writable.getWriter();
  let running = true;

  void (async () => {
    while (running) {
      const next = await reader.read().catch(() => null);
      if (!next || next.done) break;
      const frame = next.value;
      let processed: VideoFrame | undefined;
      try {
        if (running && render(frame, frame.displayWidth, frame.displayHeight)) {
          processed = new VideoFrame(canvas, { timestamp: frame.timestamp });
          // The generator takes the frame (and closes it) once written.
          await writer.write(processed);
          processed = undefined;
        }
      } catch {
        // Stopped while writing: the frame never reached the generator.
        running = false;
      } finally {
        processed?.close();
        frame.close();
      }
    }
    void reader.cancel().catch(() => {});
    void writer.close().catch(() => {});
  })();

  return {
    track: generator,
    stop() {
      running = false;
      generator.stop();
    },
  };
}

/**
 * Firefox and Safari: the camera plays in a hidden video element, and each tick of a
 * worker's timer (which keeps time in a background tab) draws a frame onto the canvas,
 * whose stream is the output.
 */
function throughCanvas(
  input: MediaStreamTrack,
  render: Render,
  canvas: HTMLCanvasElement,
): Output {
  const track = canvas.captureStream(PACED_FPS).getVideoTracks()[0];
  if (!track) throw new Error("The canvas has no video track.");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([input]);
  void video.play().catch(() => {});

  const timer = new Worker("/effects/timer.js");
  timer.onmessage = () => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      render(video, video.videoWidth, video.videoHeight);
    }
  };
  timer.postMessage(Math.round(1000 / PACED_FPS));

  return {
    track,
    stop() {
      timer.terminate();
      video.pause();
      video.srcObject = null;
      track.stop();
    },
  };
}
