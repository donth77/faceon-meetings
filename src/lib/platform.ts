/** Apple keyboards use ⌘ where others use Ctrl. Browser-only. */
export const isAppleDevice = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** Screen sharing needs getDisplayMedia, which most phone browsers lack. */
export const canShareScreen = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getDisplayMedia === "function";

/** Keyboard shortcuts stay out of the way while someone types. */
export const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

type UserAgentData = { brands: Array<{ brand: string }> };

/**
 * Chromium browsers (Chrome, Edge, …) take hints for the screen-share picker and can
 * share a tab's sound. Firefox and Safari show their own picker, without sound.
 */
export const isChromium = () =>
  typeof navigator !== "undefined" &&
  (
    navigator as Navigator & { userAgentData?: UserAgentData }
  ).userAgentData?.brands.some((b) => b.brand === "Chromium") === true;
