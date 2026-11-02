"use client";

/**
 * A short two-note chime, made with Web Audio so there's no file to load. Browsers allow
 * sound once someone has interacted with the page, which joining a meeting is.
 */
export function playChime(notes: readonly number[] = [880, 1175]): void {
  if (typeof AudioContext === "undefined") return;
  try {
    const audio = new AudioContext();
    const start = audio.currentTime + 0.02;
    notes.forEach((frequency, index) => {
      const at = start + index * 0.16;
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.45);
      tone.connect(gain).connect(audio.destination);
      tone.start(at);
      tone.stop(at + 0.5);
    });
    setTimeout(() => void audio.close(), 1200);
  } catch {
    // No sound is fine; the visual notice still shows.
  }
}
