"use client";

import { loadPreferences, withDefaults } from "@/lib/preferences";

/**
 * The meeting's sounds, as in Meet: short and quiet, made with Web Audio so there's no
 * file to load. Each is a few notes: [frequency in Hz, start in seconds].
 */
const SOUNDS = {
  /** You're in. */
  youJoined: {
    notes: [
      [523, 0],
      [659, 0.09],
      [784, 0.18],
    ],
    volume: 0.12,
  },
  /** You left, or the meeting ended. */
  youLeft: {
    notes: [
      [784, 0],
      [659, 0.1],
      [523, 0.2],
    ],
    volume: 0.1,
  },
  /** Someone else joined. */
  someoneJoined: {
    notes: [
      [784, 0],
      [1047, 0.11],
    ],
    volume: 0.08,
  },
  /** Someone else left. */
  someoneLeft: {
    notes: [
      [880, 0],
      [659, 0.12],
    ],
    volume: 0.07,
  },
  /** A hand went up (hosts hear it). */
  handRaised: { notes: [[1319, 0]], volume: 0.1 },
  /** A reaction, when Settings → Reactions → Sound is on. */
  reaction: { notes: [[1175, 0]], volume: 0.05 },
  /** A message arrived while Chat is closed. */
  message: {
    notes: [
      [988, 0],
      [1319, 0.06],
    ],
    volume: 0.06,
  },
  /** Someone is asking to join from the waiting room. */
  knock: {
    notes: [
      [660, 0],
      [880, 0.16],
    ],
    volume: 0.18,
  },
  /** The host let you in. */
  admitted: {
    notes: [
      [880, 0],
      [1175, 0.16],
    ],
    volume: 0.18,
  },
} satisfies Record<string, { notes: Array<[number, number]>; volume: number }>;

export type MeetingSound = keyof typeof SOUNDS;

let audio: AudioContext | null = null;
const lastPlayed = new Map<MeetingSound, number>();

/**
 * Plays a meeting sound, unless Meeting sounds is off in Settings. Browsers allow sound
 * once someone has interacted with the page, which joining a meeting is. The same sound
 * twice within a moment plays once.
 */
export function playSound(sound: MeetingSound): void {
  if (typeof AudioContext === "undefined") return;
  if (!withDefaults(loadPreferences()).meetingSounds) return;
  const now = performance.now();
  if (now - (lastPlayed.get(sound) ?? -Infinity) < 400) return;
  lastPlayed.set(sound, now);
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const { notes, volume } = SOUNDS[sound];
    const start = audio.currentTime + 0.02;
    for (const [frequency, offset] of notes) {
      const at = start + offset;
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.4);
      tone.connect(gain).connect(audio.destination);
      tone.start(at);
      tone.stop(at + 0.45);
    }
  } catch {
    // No sound is fine; every sound has a visual notice too.
  }
}
