import { ImageSegmenter } from "@mediapipe/tasks-vision";

/**
 * MediaPipe's selfie segmenter (Apache-2.0), which finds the person in each frame. Its
 * files come from our own origin: the model is in public/effects, and
 * scripts/effects-assets.mjs copies the Wasm there from the package.
 */
const BASE = "/effects";

let loading: Promise<ImageSegmenter> | null = null;
let lastTimestamp = 0;

let quieted = false;

/**
 * MediaPipe's runtime reports a routine start-up line ("INFO: Created TensorFlow Lite
 * XNNPACK delegate for CPU.") through console.error; drop that one line, so the console
 * keeps meaning something.
 */
function quietStartupNotice() {
  if (quieted) return;
  quieted = true;
  const report = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const [first] = args;
    if (
      typeof first === "string" &&
      first.startsWith("INFO: Created TensorFlow Lite")
    ) {
      return;
    }
    report(...args);
  };
}

/** Loads the segmenter once, when an effect first needs it; a failure can be retried. */
export function loadSegmenter(): Promise<ImageSegmenter> {
  quietStartupNotice();
  if (!loading) {
    loading = ImageSegmenter.createFromOptions(
      {
        wasmLoaderPath: `${BASE}/vision_wasm_internal.js`,
        wasmBinaryPath: `${BASE}/vision_wasm_internal.wasm`,
      },
      {
        baseOptions: {
          modelAssetPath: `${BASE}/selfie_segmenter_landscape.tflite`,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      },
    );
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/**
 * Finds the person in a frame and hands their mask to `use`: how sure the model is, per
 * pixel and top row first, that it's them. The mask is only valid during the call.
 */
export function segment(
  segmenter: ImageSegmenter,
  frame: TexImageSource,
  use: (confidence: Float32Array, width: number, height: number) => void,
) {
  // Each frame's time must be later than the last, whichever camera it came from.
  lastTimestamp = Math.max(lastTimestamp + 1, Math.round(performance.now()));
  segmenter.segmentForVideo(frame, lastTimestamp, (result) => {
    const masks = result.confidenceMasks ?? [];
    // The selfie model has one mask, the person. Models with more put the background first.
    const person = masks.length === 1 ? masks[0] : undefined;
    const background = masks.length > 1 ? masks[0] : undefined;
    if (person) {
      use(person.getAsFloat32Array(), person.width, person.height);
    } else if (background) {
      use(
        background.getAsFloat32Array().map((value) => 1 - value),
        background.width,
        background.height,
      );
    }
  });
}
