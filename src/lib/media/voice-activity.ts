/**
 * Whether someone is speaking, from how loud their audio is, measured in the browser a
 * few dozen times a second. It turns on within a measurement or two of their voice,
 * holds through the gaps between words, and learns the room's own noise as it goes, so
 * a steady fan or hum doesn't count as speech for long.
 */

/** Quieter than this (about −46 dBFS) is never speech, however quiet the room. */
const SILENCE = 0.005;
/** How far above the room's noise a voice must be: 4 times as loud (12 dB). */
const ABOVE_NOISE = 4;
/** A voice must last this long to count, so a click or a tap on the desk doesn't. */
export const ATTACK_MS = 40;
/** The ring stays this long after the voice stops, through the gaps between words. */
export const HOLD_MS = 450;
/**
 * How fast the learned noise rises toward a louder room: 4 dB a second. Speech dips
 * between words, which brings the floor straight back down; a steady noise doesn't, so
 * it stops counting after a few seconds.
 */
const FLOOR_RISE_PER_SECOND = 10 ** (4 / 20);
/** Where the floor rises from after true silence. */
const LOWEST_FLOOR = SILENCE / ABOVE_NOISE / 4;

export type VoiceActivity = {
  speaking: boolean;
  /** How loud, from 0 to 1: the RMS of the latest samples. */
  level: number;
  /** The room's own noise, learned from the quietest moments. */
  floor: number;
  /** When it was last measured, in ms. */
  at: number;
  /** Since when it has been loud enough, or quiet, without a break. */
  loudSince: number | null;
  quietSince: number | null;
};

export const QUIET: VoiceActivity = {
  speaking: false,
  level: 0,
  floor: 0,
  at: 0,
  loudSince: null,
  quietSince: null,
};

/** The next state, from the RMS of the samples measured at `now` (ms). */
export function nextVoiceActivity(
  state: VoiceActivity,
  rms: number,
  now: number,
): VoiceActivity {
  // The floor drops at once to anything quieter and rises slowly toward anything louder:
  // it follows the noise between words, not the words. It starts low, so someone who
  // speaks as soon as they're heard lights up at once.
  const elapsed = state.at === 0 ? 0 : Math.max(0, now - state.at);
  const floor =
    rms <= state.floor
      ? rms
      : Math.min(
          rms,
          Math.max(state.floor, LOWEST_FLOOR) *
            FLOOR_RISE_PER_SECOND ** (elapsed / 1000),
        );
  const loud = rms > Math.max(SILENCE, state.floor * ABOVE_NOISE);
  const loudSince = loud ? (state.loudSince ?? now) : null;
  const quietSince = loud ? null : (state.quietSince ?? now);
  const speaking = state.speaking
    ? quietSince === null || now - quietSince < HOLD_MS
    : loudSince !== null && now - loudSince >= ATTACK_MS;
  return {
    speaking,
    level: Math.min(1, rms),
    floor,
    at: now,
    loudSince,
    quietSince,
  };
}

/** The RMS of a block of samples. */
export function rmsOf(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length);
}
