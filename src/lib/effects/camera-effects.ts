import type { CameraProcessor } from "@/lib/media/types";

import type { Effect } from "./effects";
import type { EffectsEvents, EffectsProcessor } from "./engine";

/** The engine loads on first use, so MediaPipe stays out of everything else. */
export const loadEffectsEngine = () => import("./engine");

/** Why effects stopped, or a background didn't change. */
export type EffectsProblem =
  | { kind: "tooSlow" }
  | { kind: "failed" }
  | { kind: "backgroundFailed"; showing: Effect };

/** Turns the engine's events into problems for one handler. */
export function reportingTo(
  report: (problem: EffectsProblem) => void,
): EffectsEvents {
  return {
    onTooSlow: () => report({ kind: "tooSlow" }),
    onFailed: () => report({ kind: "failed" }),
    onBackgroundFailed: (showing) =>
      report({ kind: "backgroundFailed", showing }),
  };
}

/** A meeting camera's effect, for whichever media provider runs the session. */
export type CameraEffects = {
  /** Runs on each camera stream the provider opens, before anything is sent. */
  processor: CameraProcessor;
  /** Switches the running camera to this effect, without restarting it. */
  set: (effect: Effect) => void;
  /** Tells the room when effects have to stop. Returns the unsubscribe function. */
  subscribe: (handler: (problem: EffectsProblem) => void) => () => void;
};

export function createCameraEffects(initial: Effect): CameraEffects {
  let effect = initial;
  const running = new Set<EffectsProcessor>();
  const handlers = new Set<(problem: EffectsProblem) => void>();
  const events = reportingTo((problem) =>
    handlers.forEach((handler) => handler(problem)),
  );

  return {
    processor(input) {
      const camera = input.getVideoTracks()[0];
      let started: EffectsProcessor | undefined;
      let stopped = false;
      const output = (async () => {
        if (!camera) return input;
        try {
          const { startEffects } = await loadEffectsEngine();
          if (stopped) return new MediaStream();
          started = startEffects(camera, effect, events);
          running.add(started);
          return new MediaStream([started.track]);
        } catch {
          // Never send the camera as it is instead: a blank picture, while the room
          // turns the video off.
          events.onFailed?.();
          return new MediaStream([blankTrack()]);
        }
      })();
      return {
        output,
        stop() {
          stopped = true;
          if (!started) return;
          running.delete(started);
          started.stop();
        },
      };
    },
    set(next) {
      effect = next;
      running.forEach((processor) => processor.setEffect(next));
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

/** A black picture, for when an effect can't run. */
function blankTrack(): MediaStreamTrack {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const track = canvas.captureStream(1).getVideoTracks()[0];
  if (!track) throw new Error("The canvas has no video track.");
  return track;
}
