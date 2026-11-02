import { supports } from "@/lib/capabilities";

let failed = false;
let told = false;
const listeners = new Set<() => void>();

/**
 * Strong suppression can run here (an AudioWorklet and WebAssembly on a secure page,
 * lib/capabilities.ts), and hasn't failed during this visit.
 */
export function strongAvailable(): boolean {
  return !failed && supports("strongNoise");
}

/**
 * Strong suppression couldn't start, or stopped working: standard instead until the
 * page reloads, so a microphone never keeps switching back and forth.
 */
export function strongFailed(): void {
  if (failed) return;
  failed = true;
  listeners.forEach((listener) => listener());
}

/** True the first time it's asked after a failure: when to say that standard is on. */
export function takeFailureNotice(): boolean {
  if (!failed || told) return false;
  told = true;
  return true;
}

export function subscribeStrong(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
