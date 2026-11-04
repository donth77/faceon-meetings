import { useSyncExternalStore } from "react";

/**
 * A parameter of this page's link (?next=, ?error=, ?email=), read in the browser.
 * useSearchParams() would keep its component out of the prerendered page, behind a
 * placeholder, until the page's script runs; these leave the page whole. `linkParam` is
 * for when someone acts (a click, a submit); `useLinkParam` for what can show a moment
 * after the page does: it's null on the server and while the page hydrates.
 */
export function linkParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

const subscribeNever = () => () => {};

export function useLinkParam(name: string): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => linkParam(name),
    () => null,
  );
}
