import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** This page's origin ("https://example.com"), or "" while rendering on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
