/**
 * Noise suppression on the microphone (Settings → Audio):
 * - off: the microphone as it is (echo cancellation and level still apply);
 * - standard: the browser's own suppressor, which mostly takes out steady noise like
 *   fans and hum;
 * - strong: RNNoise, a small neural network running on the device (engine.ts), which
 *   also takes out typing, traffic and other people talking nearby.
 */
export const NOISE_SUPPRESSION = ["off", "standard", "strong"] as const;
export type NoiseSuppression = (typeof NOISE_SUPPRESSION)[number];

/**
 * Reads a stored choice. An earlier version stored a switch: off stays off, and on
 * (the default then) follows today's default.
 */
export function parseNoiseSuppression(
  value: unknown,
): NoiseSuppression | undefined {
  if (value === false) return "off";
  return NOISE_SUPPRESSION.find((mode) => mode === value);
}

/** What runs: strong only where this browser can run it, standard instead. */
export function effectiveNoiseSuppression(
  chosen: NoiseSuppression,
  strongAvailable: boolean,
): NoiseSuppression {
  return chosen === "strong" && !strongAvailable ? "standard" : chosen;
}

/**
 * Whether to ask the browser for its own suppression. Strong replaces it rather than
 * adding to it: running both took more of the speech away than strong alone.
 */
export const browserSuppression = (mode: NoiseSuppression): boolean =>
  mode === "standard";
