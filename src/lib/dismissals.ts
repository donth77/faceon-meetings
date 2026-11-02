import { useSyncExternalStore } from "react";

/**
 * Suggestions someone put away for good on this device ("Not now"), each kept in
 * localStorage as faceon.<name>. Where storage is blocked (a private window, say), a
 * dismissal lasts until the page reloads.
 */
export type Dismissible = "installCard" | "calendarSuggestion";

const listeners = new Set<() => void>();
const thisVisit = new Set<Dismissible>();

const storageKey = (name: Dismissible) => `faceon.${name}`;

function isDismissed(name: Dismissible): boolean {
  if (thisVisit.has(name)) return true;
  try {
    return localStorage.getItem(storageKey(name)) === "dismissed";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Puts a suggestion away on this device. */
export function dismiss(name: Dismissible) {
  thisVisit.add(name);
  try {
    localStorage.setItem(storageKey(name), "dismissed");
  } catch {
    // Not remembered past this visit; nothing else to do.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Whether a suggestion was put away. `hiddenOnServer` decides the first render, before
 * the device's storage is known: true keeps a one-time card from flashing for people who
 * dismissed it; false keeps a card that's usually shown from shifting the page in.
 */
export function useDismissed(
  name: Dismissible,
  { hiddenOnServer }: { hiddenOnServer: boolean },
): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isDismissed(name),
    () => hiddenOnServer,
  );
}
