import { describe, expect, it } from "vitest";

import {
  HOLD_MS,
  nextVoiceActivity,
  QUIET,
  rmsOf,
  type VoiceActivity,
} from "./voice-activity";

const TICK_MS = 50;
const VOICE = 0.1;
const SILENT = 0.0005;

/** Runs the rules over RMS readings, one per tick: whether each tick shows speaking. */
function speakingOver(levels: number[]): boolean[] {
  let state: VoiceActivity = QUIET;
  return levels.map((rms, index) => {
    state = nextVoiceActivity(state, rms, 1000 + index * TICK_MS);
    return state.speaking;
  });
}

const repeat = (rms: number, ms: number) =>
  Array<number>(Math.round(ms / TICK_MS)).fill(rms);

describe("voice activity", () => {
  it("lights up on the second measurement of a voice", () => {
    const shown = speakingOver([...repeat(SILENT, 500), VOICE, VOICE]);
    expect(shown.at(-2)).toBe(false);
    expect(shown.at(-1)).toBe(true);
  });

  it("doesn't light up for a click", () => {
    const shown = speakingOver([
      ...repeat(SILENT, 500),
      VOICE,
      ...repeat(SILENT, 1000),
    ]);
    expect(shown).not.toContain(true);
  });

  it("holds through the gaps between words, then goes out", () => {
    const shown = speakingOver([
      ...repeat(VOICE, 500),
      ...repeat(SILENT, 300),
      ...repeat(VOICE, 500),
      ...repeat(SILENT, 1000),
    ]);
    // On from the second tick to the end of the second word, without a break.
    expect(shown.slice(1, 26)).not.toContain(false);
    const quietFrom = 26;
    const out = shown.indexOf(false, quietFrom);
    expect((out - quietFrom + 1) * TICK_MS).toBeGreaterThanOrEqual(HOLD_MS);
    expect((out - quietFrom) * TICK_MS).toBeLessThanOrEqual(HOLD_MS + TICK_MS);
  });

  it("never counts a quiet room", () => {
    expect(speakingOver(repeat(0.003, 5000))).not.toContain(true);
  });

  it("stops counting a steady noise after a few seconds", () => {
    const shown = speakingOver(repeat(0.02, 10_000));
    expect(shown.slice(-40)).not.toContain(true);
  });

  it("keeps counting a voice that dips between words", () => {
    const words = Array.from({ length: 20 }, () => [
      ...repeat(VOICE, 400),
      ...repeat(SILENT, 100),
    ]).flat();
    expect(speakingOver(words).slice(1)).not.toContain(false);
  });

  it("follows the room's noise up and down", () => {
    let state: VoiceActivity = QUIET;
    let now = 1000;
    const step = (rms: number) => {
      now += TICK_MS;
      state = nextVoiceActivity(state, rms, now);
    };
    for (let i = 0; i < 200; i++) step(0.02);
    const risen = state.floor;
    expect(risen).toBeGreaterThan(0.005);
    expect(risen).toBeLessThanOrEqual(0.02);
    step(SILENT);
    expect(state.floor).toBe(SILENT);
  });

  it("measures the level, never above 1", () => {
    expect(rmsOf(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rmsOf(new Float32Array(0))).toBe(0);
    expect(nextVoiceActivity(QUIET, 1.4, 1000).level).toBe(1);
  });
});
