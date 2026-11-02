/**
 * Whether nothing on the page has focus because what had it is gone: removed, or hidden
 * (a page Next.js keeps hidden after navigating away from it).
 */
export function focusIsLost(): boolean {
  const active = document.activeElement;
  return (
    !active || active === document.body || active.getClientRects().length === 0
  );
}
