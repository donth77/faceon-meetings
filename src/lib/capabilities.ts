import { isChromium, isDesktopChrome, isTypingTarget } from "./platform";

/**
 * What this browser and device can do, worked out in one place. A feature that needs
 * one of these shows only where it's there: hidden where it can never work, and shown
 * disabled with a reason only where something on this device can make it work (a
 * permission, a download, adding the app to the Home Screen). A saved choice the browser
 * can't run falls back quietly. Every check is false on the server; components read them
 * with useCapability (hooks/use-capability.ts), which matches the server's HTML while the
 * page hydrates.
 */
export const CAPABILITIES = [
  /** Document Picture-in-Picture: Chrome and Edge on a computer, and recent Firefox. */
  "pictureInPicture",
  /** Picture-in-picture opening by itself when you switch away from a call: Chrome and Edge. */
  "autoPictureInPicture",
  /** Joining a call at all (WebRTC): every current browser, unless it's been turned off. */
  "calls",
  /** Using a camera and microphone (getUserMedia): every current browser, on a secure page. */
  "media",
  /** Sharing a screen (getDisplayMedia): browsers on computers, not phones. */
  "screenShare",
  /** Choosing what to share before the browser's picker, and sharing a tab's sound: Chrome and Edge on a computer. */
  "shareOptions",
  /** Sharing part of a screen, cropped on the device from its frames: Chrome and Edge on a computer. */
  "sharePart",
  /** Choosing where sound plays (setSinkId): Chrome, Edge and Firefox on a computer. */
  "chooseSpeaker",
  /** Filling the screen with the page: everywhere but iPhone. */
  "fullscreen",
  /** Strong noise suppression: an AudioWorklet and WebAssembly, on a secure page. */
  "strongNoise",
  /** Backgrounds and effects: WebAssembly, WebGL2 and a way to make video from drawn frames. */
  "effects",
  /** The motion backgrounds' footage (H.264 in MP4) plays. */
  "motionBackgrounds",
  /** System notifications. */
  "notifications",
  /** No notifications here yet, but adding the app to the Home Screen brings them: iPhone and iPad. */
  "notificationsOnceInstalled",
  /** A keyboard: a mouse or trackpad is attached, or a key was pressed outside a text field. */
  "keyboard",
  /**
   * AI on the device, for AI notes (speech to text, and Chrome's built-in AI to make the
   * notes): Google Chrome on a computer. Whether each is ready, or needs its one-time
   * download, Chrome says when asked; other browsers aren't asked.
   */
  "onDeviceAi",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** The motion backgrounds' format: H.264 (High profile, level 3.1) in MP4. */
const FOOTAGE_TYPE = 'video/mp4; codecs="avc1.64001F"';

/** Pointers that come with a keyboard more often than not: a mouse or a trackpad. */
const FINE_POINTER = ["(any-hover: hover)", "(any-pointer: fine)"] as const;

/** iPhone and iPad, including an iPad asking for desktop sites as a Mac with a touch screen. */
const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/** Opened as an installed app rather than in a browser tab. */
const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** WebAssembly for the model, WebGL2 for drawing, and drawn frames turned into a track. */
function runsEffects(): boolean {
  const canvas = document.createElement("canvas");
  const makesTracks =
    "MediaStreamTrackGenerator" in window ||
    typeof canvas.captureStream === "function";
  let webgl2 = false;
  try {
    const gl = canvas.getContext("webgl2");
    webgl2 = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return typeof WebAssembly === "object" && makesTracks && webgl2;
}

/** The checks that can't change during a visit; each runs once. */
const CHECKS: Record<Exclude<Capability, "keyboard">, () => boolean> = {
  pictureInPicture: () =>
    typeof (
      window as Window & {
        documentPictureInPicture?: { requestWindow?: unknown };
      }
    ).documentPictureInPicture?.requestWindow === "function",
  // Chrome's media session action; asking for it without setting it would clear a
  // meeting's own handler, so it's known by the browser instead.
  autoPictureInPicture: () =>
    supports("pictureInPicture") && isChromium() && "mediaSession" in navigator,
  calls: () => typeof RTCPeerConnection === "function",
  media: () => typeof navigator.mediaDevices?.getUserMedia === "function",
  screenShare: () =>
    typeof navigator.mediaDevices?.getDisplayMedia === "function",
  shareOptions: () => supports("screenShare") && isChromium(),
  sharePart: () =>
    supports("shareOptions") &&
    "MediaStreamTrackProcessor" in window &&
    "MediaStreamTrackGenerator" in window &&
    typeof VideoFrame === "function",
  chooseSpeaker: () =>
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype,
  fullscreen: () => document.fullscreenEnabled === true,
  strongNoise: () =>
    typeof AudioWorkletNode === "function" &&
    typeof WebAssembly === "object" &&
    window.isSecureContext === true,
  effects: runsEffects,
  motionBackgrounds: () =>
    document.createElement("video").canPlayType(FOOTAGE_TYPE) !== "",
  notifications: () => typeof Notification !== "undefined",
  onDeviceAi: isDesktopChrome,
  notificationsOnceInstalled: () =>
    !supports("notifications") && isAppleMobile() && !standalone(),
};

const known = new Map<Capability, boolean>();

/** Whether this browser and device can do it; false on the server. */
export function supports(capability: Capability): boolean {
  if (typeof window === "undefined") return false;
  if (capability === "keyboard") return hasKeyboard();
  let answer = known.get(capability);
  if (answer === undefined) {
    try {
      answer = CHECKS[capability]();
    } catch {
      answer = false;
    }
    known.set(capability, answer);
  }
  return answer;
}

// A keyboard can turn up during a visit: a key pressed, or a mouse plugged in.
let keyPressed = false;
let watching = false;
const keyboardListeners = new Set<() => void>();
const keyboardChanged = () =>
  keyboardListeners.forEach((listener) => listener());

function hasKeyboard(): boolean {
  watchKeyboard();
  return (
    keyPressed ||
    FINE_POINTER.some((query) => window.matchMedia?.(query).matches === true)
  );
}

function watchKeyboard() {
  if (watching) return;
  watching = true;
  const onKey = (event: KeyboardEvent) => {
    // An on-screen keyboard types only into text fields, so a key pressed anywhere
    // else came from a real one.
    if (isTypingTarget(event.target)) return;
    keyPressed = true;
    window.removeEventListener?.("keydown", onKey, true);
    keyboardChanged();
  };
  window.addEventListener?.("keydown", onKey, true);
  for (const query of FINE_POINTER) {
    window.matchMedia?.(query).addEventListener?.("change", keyboardChanged);
  }
}

const NEVER_CHANGES = () => () => {};

/** Calls back when the answer may have changed (only a keyboard turns up mid-visit). */
export function subscribeCapability(
  capability: Capability,
  onChange: () => void,
): () => void {
  if (capability !== "keyboard" || typeof window === "undefined") {
    return NEVER_CHANGES();
  }
  watchKeyboard();
  keyboardListeners.add(onChange);
  return () => keyboardListeners.delete(onChange);
}
