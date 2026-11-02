import { useSyncExternalStore } from "react";

/**
 * Installing FaceOn as an app. Chrome and Edge (on computers and Android) offer it
 * through `beforeinstallprompt`, kept here for FaceOn's own Install button. Safari has no
 * prompt: on an iPhone or iPad it's Share › Add to Home Screen, and on a Mac, Add to Dock.
 * Firefox on a computer can't install apps.
 */

/** Chrome's install prompt, which isn't in TypeScript's DOM types. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** How this browser can install FaceOn, if it can. */
export type InstallWay =
  /** Running as the installed app, or just installed. */
  | "installed"
  /** Chrome or Edge: FaceOn's Install button opens the browser's prompt. */
  | "prompt"
  /** iPhone or iPad, in any browser: Share › Add to Home Screen. */
  | "ios"
  /** Safari on a Mac: File › Add to Dock. */
  | "macSafari"
  | "none";

export function installWay(device: {
  /** Opened as the installed app (display-mode: standalone, or iOS's navigator.standalone). */
  standalone: boolean;
  /** The browser said FaceOn was just installed (appinstalled). */
  installed: boolean;
  /** A beforeinstallprompt is waiting to be shown. */
  canPrompt: boolean;
  userAgent: string;
  /** navigator.maxTouchPoints: an iPad asks for desktop sites as a Mac with a touch screen. */
  touchPoints: number;
}): InstallWay {
  if (device.standalone || device.installed) return "installed";
  if (device.canPrompt) return "prompt";
  const ua = device.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && device.touchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadAsMac) return "ios";
  const otherBrowser = /Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR/.test(ua);
  if (
    /Macintosh/.test(ua) &&
    /Version\/[\d.]+.*Safari/.test(ua) &&
    !otherBrowser
  ) {
    return "macSafari";
  }
  return "none";
}

let waiting: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  // Listening from the moment this module loads: the browser fires it once.
  window.addEventListener("beforeinstallprompt", (event) => {
    // FaceOn's own Install button replaces the browser's mini-infobar.
    event.preventDefault();
    waiting = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    waiting = null;
    installedNow = true;
    notify();
  });
}

const standaloneQuery = () => window.matchMedia("(display-mode: standalone)");

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Opening the installed app switches the display mode without a reload in some browsers.
  const query = standaloneQuery();
  query.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", listener);
  };
}

function currentWay(): InstallWay {
  return installWay({
    standalone:
      standaloneQuery().matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    installed: installedNow,
    canPrompt: waiting !== null,
    userAgent: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints,
  });
}

/*
 * The functions that change this module's state live outside the hooks: the React
 * Compiler assumes module variables never change, and inside a hook it would read
 * `waiting` after it was cleared.
 */

/** Shows the browser's prompt (once: the browser allows it only once); true if accepted. */
async function install(): Promise<boolean> {
  const event = waiting;
  if (!event) return false;
  waiting = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

/** How this browser can install FaceOn, and `install()` for the "prompt" way. */
export function useInstall() {
  const way = useSyncExternalStore(
    subscribe,
    currentWay,
    () => "none" as const,
  );
  return { way, install };
}

const CARD_KEY = "faceon.installCard";
const cardListeners = new Set<() => void>();
let dismissedThisVisit = false;

function cardDismissed(): boolean {
  try {
    return localStorage.getItem(CARD_KEY) === "dismissed";
  } catch {
    // Storage blocked (a private window, say): show it, and let Not now hide it for now.
    return false;
  }
}

function dismiss() {
  dismissedThisVisit = true;
  try {
    localStorage.setItem(CARD_KEY, "dismissed");
  } catch {
    // Not remembered past this visit; nothing else to do.
  }
  cardListeners.forEach((listener) => listener());
}

function subscribeCard(listener: () => void) {
  cardListeners.add(listener);
  return () => {
    cardListeners.delete(listener);
  };
}

/** Home's one-time "Get the app" card on phones: whether it was put away, and putting it away. */
export function useInstallCard() {
  const dismissed = useSyncExternalStore(
    subscribeCard,
    () => dismissedThisVisit || cardDismissed(),
    () => true,
  );
  return { dismissed, dismiss };
}
