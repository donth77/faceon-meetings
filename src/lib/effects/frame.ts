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
 * for the GPU, steadied over time only where the model is unsure. A pixel it's sure about
 * takes the new value at once, so edges keep up when you move; one near 0.5 leans on the
 * last frame, so edges don't flicker. (MediaPipe's own segmentation smoothing.)
 */
export class MaskSmoother {
  private level = new Float32Array(0);
  private bytes = new Uint8ClampedArray(0);

  /** `keep`: how much of the last frame an unsure pixel keeps, from 0 to 1. */
  constructor(private readonly keep = 0.7) {}

  update(confidence: Float32Array): Uint8ClampedArray {
    if (this.level.length !== confidence.length) {
      this.level = Float32Array.from(confidence);
      this.bytes = new Uint8ClampedArray(confidence.length);
    }
    for (let i = 0; i < confidence.length; i++) {
      const next = Math.min(1, Math.max(0, confidence[i] ?? 0));
      const previous = this.level[i] ?? next;
      const value = next + (previous - next) * uncertainty(next) * this.keep;
      this.level[i] = value;
      this.bytes[i] = value * 255;
    }
    return this.bytes;
  }
}

/**
 * How unsure a confidence is: 1 at 0.5, falling to 0 at 0 and 1. MediaPipe's polynomial
 * fit of 1 - (1 - H(p))², H being the binary entropy.
 */
export function uncertainty(confidence: number): number {
  const t = confidence - 0.5;
  const x = t * t;
  const certainty =
    x *
    (5.68842 + x * (-0.748699 + x * (-57.8051 + x * (291.309 + x * -624.717))));
  return 1 - Math.min(1, Math.max(0, certainty));
}

/**
 * Where frames are drawn on a timer (Firefox, Safari), which ticks draw. A camera slower
 * than the timer (in low light, say) would have each frame found and drawn twice, so
 * while the browser says when it shows a new frame, a tick draws only a new one. Once
 * it hasn't said for a while (a background tab, a window out of sight, or a browser that
 * never says), every tick draws, as before.
 */
export class FramePacer {
  private shownAt = -Infinity;
  private drawn = false;

  /** `quietMs`: how long without word of a new frame before every tick draws again. */
  constructor(private readonly quietMs: number) {}

  /** The browser showed a new frame. */
  shown(now: number): void {
    this.shownAt = now;
    this.drawn = false;
  }

  /** The page went to the background or came back: every tick draws until word comes. */
  forget(): void {
    this.shownAt = -Infinity;
  }

  /** Whether this tick draws. */
  due(now: number): boolean {
    return !this.drawn || now - this.shownAt > this.quietMs;
  }

  /** This tick drew the frame. */
  done(): void {
    this.drawn = true;
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
