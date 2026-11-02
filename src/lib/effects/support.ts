import { runnableEffect, type Effect } from "./effects";

let supported: boolean | undefined;

/**
 * Whether this browser can run backgrounds and effects: WebAssembly for the model,
 * WebGL2 for drawing, and a way to turn drawn frames into a video track. Where it
 * can't, the button isn't shown. Slow devices are caught later, frame by frame.
 */
export function effectsSupported(): boolean {
  if (supported !== undefined) return supported;
  if (typeof window === "undefined") return false;
  const canvas = document.createElement("canvas");
  const makesTracks =
    "MediaStreamTrackGenerator" in window ||
    typeof canvas.captureStream === "function";
  let webgl2 = false;
  try {
    const gl = canvas.getContext("webgl2");
    webgl2 = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  supported = typeof WebAssembly === "object" && makesTracks && webgl2;
  return supported;
}

/** The motion backgrounds' format: H.264 (High profile, level 3.1) in MP4. */
const FOOTAGE_TYPE = 'video/mp4; codecs="avc1.64001F"';
let playsFootage: boolean | undefined;

/**
 * Whether this browser plays the motion backgrounds' footage. Nearly all do; where one
 * can't (some Linux browsers without H.264), motion backgrounds aren't offered.
 */
export function footageSupported(): boolean {
  if (playsFootage !== undefined) return playsFootage;
  if (typeof document === "undefined") return false;
  playsFootage =
    document.createElement("video").canPlayType(FOOTAGE_TYPE) !== "";
  return playsFootage;
}

/** The saved effect if it can run on this device, otherwise null (no effect). */
export const availableEffect = (effect: Effect | null) =>
  runnableEffect(effect, {
    effects: effectsSupported(),
    footage: footageSupported(),
  });
