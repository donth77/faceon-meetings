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
