/**
 * Sending someone to their AI key: Settings → AI notes, as it next opens (in the
 * meeting's Settings dialog), puts focus on the key, as the page does when its address
 * ends in #key.
 */
let wanted = false;

/** Asks Settings → AI notes, as it next opens, to focus the key. */
export function focusKeyNext(): void {
  wanted = true;
}

/** Whether Settings → AI notes, opening now, should focus the key. Asked once. */
export function takeKeyFocus(): boolean {
  const asked = wanted || window.location.hash === "#key";
  wanted = false;
  return asked;
}
