/**
 * The menu bar's height inside the window on Windows and Linux (measured on Windows 11);
 * macOS keeps its menu at the top of the screen.
 */
export const MENU_BAR_HEIGHT = 26;

/**
 * The first window, before one has been saved: 1280 wide and tall enough that the page
 * gets 781 px below the menu bar, so the first screen fits without scrolling; or about
 * 90% of a smaller screen, never more.
 */
export function firstWindowSize(
  workArea: { width: number; height: number },
  platform: NodeJS.Platform,
): { width: number; height: number } {
  const menuBar = platform === "darwin" ? 0 : MENU_BAR_HEIGHT;
  return {
    width: Math.min(1280, Math.round(workArea.width * 0.9)),
    height: Math.min(820 + menuBar, Math.round(workArea.height * 0.9)),
  };
}
