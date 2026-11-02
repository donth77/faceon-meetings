/** Apple keyboards use ⌘ where others use Ctrl. Browser-only. */
export const isAppleDevice = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** Keyboard shortcuts stay out of the way while someone types. */
export const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Space and Enter already mean something on these: press the button, tick the box. */
export const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest(
    "button, a[href], input, textarea, select, summary, [contenteditable=true], [role=button], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=option], [role=tab], [role=slider], [role=link]",
  ) !== null;

type UserAgentData = { brands: Array<{ brand: string }>; mobile?: boolean };

/**
 * Chromium browsers (Chrome, Edge, …) take hints for the screen-share picker and can
 * share a tab's sound. Firefox and Safari show their own picker, without sound.
 */
export const isChromium = () =>
  typeof navigator !== "undefined" &&
  (
    navigator as Navigator & { userAgentData?: UserAgentData }
  ).userAgentData?.brands.some((b) => b.brand === "Chromium") === true;

/** Google Chrome on a computer (not Edge, other Chromium browsers or Chrome on a phone). */
export const isDesktopChrome = () => {
  if (typeof navigator === "undefined") return false;
  const data = (navigator as Navigator & { userAgentData?: UserAgentData })
    .userAgentData;
  return (
    data?.brands.some((b) => b.brand === "Google Chrome") === true &&
    data.mobile !== true
  );
};
