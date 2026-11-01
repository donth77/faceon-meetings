import { useSyncExternalStore } from "react";

const subscribers = new Map<number, (onTick: () => void) => () => void>();

function subscribeEvery(intervalMs: number) {
  let subscribe = subscribers.get(intervalMs);
  if (!subscribe) {
    subscribe = (onTick) => {
      const timer = window.setInterval(onTick, Math.min(intervalMs, 10_000));
      return () => window.clearInterval(timer);
    };
    subscribers.set(intervalMs, subscribe);
  }
  return subscribe;
}

/**
 * The current time, rounded down to `intervalMs`, or null during server rendering. It
 * changes once per interval, so components re-render only when what they show changes.
 */
export function useNow(intervalMs: number): number | null {
  return useSyncExternalStore(
    subscribeEvery(intervalMs),
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
