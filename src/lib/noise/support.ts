let capable: boolean | undefined;
let failed = false;
let told = false;
const listeners = new Set<() => void>();

/** Whether this browser can run strong suppression: an AudioWorklet and WebAssembly. */
export function strongSupported(): boolean {
  if (capable !== undefined) return capable;
  if (typeof window === "undefined") return false;
  capable =
    typeof AudioWorkletNode === "function" &&
    typeof WebAssembly === "object" &&
    window.isSecureContext;
  return capable;
}

/** Strong suppression can run here, and hasn't failed during this visit. */
export function strongAvailable(): boolean {
  return !failed && strongSupported();
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
