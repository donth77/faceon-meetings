/**
 * The effects engine's arithmetic, kept apart from WebGL and MediaPipe so it can be
 * unit-tested.
 */

type Size = { width: number; height: number };

/**
 * How much of a background to show so it covers the frame, cropping what doesn't fit
 * (CSS's object-fit: cover): sample it at 0.5 + (uv - 0.5) * scale.
 */
export function coverScale(background: Size, frame: Size): [number, number] {
  const backgroundAspect = background.width / background.height;
  const frameAspect = frame.width / frame.height;
  return backgroundAspect > frameAspect
    ? [frameAspect / backgroundAspect, 1] // wider: crop the sides
    : [1, backgroundAspect / frameAspect]; // taller: crop top and bottom
}

/**
 * The middle 16:9 of a picture, and the size to draw it at: `maxWidth` wide at most,
 * never larger than the original.
 */
export function wideCrop(picture: Size, maxWidth: number) {
  const aspect = 16 / 9;
  const sourceWidth = Math.min(picture.width, picture.height * aspect);
  const sourceHeight = sourceWidth / aspect;
  const width = Math.max(1, Math.round(Math.min(maxWidth, sourceWidth)));
  return {
    sx: (picture.width - sourceWidth) / 2,
    sy: (picture.height - sourceHeight) / 2,
    sw: sourceWidth,
    sh: sourceHeight,
    width,
    height: Math.max(1, Math.round(width / aspect)),
  };
}

/**
 * Turns each frame's person mask (a confidence from 0 to 1 per pixel) into 8-bit alpha
 * for the GPU, eased toward each new mask so edges don't flicker between frames.
 */
export class MaskSmoother {
  private level = new Float32Array(0);
  private bytes = new Uint8ClampedArray(0);

  /** `follow`: how far each new mask moves the edges, from 0 (never) to 1 (at once). */
  constructor(private readonly follow = 0.65) {}

  update(confidence: Float32Array): Uint8ClampedArray {
    if (this.level.length !== confidence.length) {
      this.level = Float32Array.from(confidence);
      this.bytes = new Uint8ClampedArray(confidence.length);
    }
    for (let i = 0; i < confidence.length; i++) {
      const previous = this.level[i] ?? 0;
      const next = previous + ((confidence[i] ?? 0) - previous) * this.follow;
      this.level[i] = next;
      this.bytes[i] = next * 255;
    }
    return this.bytes;
  }
}

/**
 * Watches how long frames take. When most frames in a stretch ran over budget, it says
 * to step down (see the processor), then starts counting again.
 */
export class FrameBudget {
  private over = 0;
  private counted = 0;

  constructor(
    private readonly budgetMs: number,
    /** Frames per stretch: about two seconds of video. */
    private readonly stretch = 60,
    /** Frames to skip at the start, while shaders compile and the model warms up. */
    private warmUp = 30,
  ) {}

  /** Records a frame's time; true when it's time to step down. */
  record(ms: number): boolean {
    if (this.warmUp > 0) {
      this.warmUp--;
      return false;
    }
    this.counted++;
    if (ms > this.budgetMs) this.over++;
    if (this.counted < this.stretch) return false;
    const slow = this.over > this.stretch * 0.6;
    this.over = 0;
    this.counted = 0;
    return slow;
  }
}
