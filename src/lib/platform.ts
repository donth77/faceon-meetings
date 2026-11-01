/** Apple keyboards use ⌘ where others use Ctrl. Browser-only. */
export const isAppleDevice = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** Screen sharing needs getDisplayMedia, which most phone browsers lack. */
export const canShareScreen = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getDisplayMedia === "function";
