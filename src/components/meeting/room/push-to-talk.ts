/**
 * Keys that move focus or work the focused control. After one of them, focus is the
 * keyboard's; after a click, it's the pointer's.
 */
export const FOCUS_KEYS: ReadonlySet<string> = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Escape",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/**
 * Whether Space talks (Push to talk, held down as in Meet): it's on, with single-key
 * shortcuts, no modifier held, and not while typing. On a control reached with the
 * keyboard, Space presses that control, as it does everywhere; a control you clicked keeps
 * focus too, but there Space still talks, so it never turns into a mute toggle.
 */
export function spaceTalks(input: {
  pushToTalk: boolean;
  singleKeyShortcuts: boolean;
  /** No Ctrl, ⌘, Alt or Shift. */
  plain: boolean;
  typing: boolean;
  /** Focus is on a button, link or other control. */
  onControl: boolean;
  /** Focus got there from the keyboard (FOCUS_KEYS), not a click. */
  keyboardFocus: boolean;
}): boolean {
  if (!input.pushToTalk || !input.singleKeyShortcuts) return false;
  if (!input.plain || input.typing) return false;
  return !(input.onControl && input.keyboardFocus);
}
