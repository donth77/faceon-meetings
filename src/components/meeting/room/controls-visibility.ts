/**
 * When a phone's meeting controls may step aside so the video gets the screen, as in
 * Meet and Zoom. Pure, so it's unit-tested; use-auto-hide.ts runs it.
 */

/** How long the controls stay up after the last touch, key or focus. */
export const HIDE_AFTER_MS = 4000;

/** A room just joined keeps its controls up this long, while people find their way. */
export const SETTLE_MS = 6000;

/** What decides whether the controls may go. */
export type RoomFacts = {
  /** A phone-sized room, upright or on its side: the only place controls hide. */
  compact: boolean;
  /** Joined at least SETTLE_MS ago, and connected. */
  settled: boolean;
  /** Sharing your screen: Stop sharing stays in reach. */
  presenting: boolean;
  /** Nobody else is here: the "only one here" card has things to do. */
  alone: boolean;
  /** A sheet, dialog, menu or popover, or a toast with a button, is open. */
  overlayOpen: boolean;
  /** Focus is on one of the controls. */
  focusInControls: boolean;
  /** Shown on request (the stage's button for screen readers): up until the video is tapped. */
  kept: boolean;
};

/** Whether the controls may hide now. */
export function mayHide(room: RoomFacts): boolean {
  return (
    room.compact &&
    room.settled &&
    !room.presenting &&
    !room.alone &&
    !room.overlayOpen &&
    !room.focusInControls &&
    !room.kept
  );
}

/**
 * Whether the controls show after a tap on the video: hidden ones come back, and shown
 * ones go when they may. A tap ends `kept`, so it's left out.
 */
export function shownAfterTap(shown: boolean, room: RoomFacts): boolean {
  if (!shown) return true;
  return !mayHide({ ...room, kept: false });
}

/**
 * Taps on these change something themselves (a tile's menu, a card's button), so they
 * don't also show or hide the controls.
 */
export const OWN_TAP_TARGETS =
  'button, a[href], input, textarea, select, label, [role="button"], [role="menuitem"], [role="slider"], [role="link"], [tabindex]:not([tabindex="-1"])';
