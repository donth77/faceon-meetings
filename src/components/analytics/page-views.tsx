"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * How long after a page loads its view is counted. Parts of a page can still be streaming
 * in and hydrating after the load event; counting waits until they're done.
 */
const AFTER_LOAD_MS = 1500;

/**
 * Calls `start` a moment after the page has loaded, when the browser is idle. Returns a
 * function that cancels it.
 */
function afterPageLoad(start: () => void): () => void {
  let cancel = () => {};
  const whenIdle = () => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 5000 });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      start(); // Safari has no idle callbacks.
    }
  };
  const wait = () => {
    const id = setTimeout(whenIdle, AFTER_LOAD_MS);
    cancel = () => clearTimeout(id);
  };
  if (document.readyState === "complete") {
    wait();
  } else {
    window.addEventListener("load", wait, { once: true });
    cancel = () => window.removeEventListener("load", wait);
  }
  return () => cancel();
}

/**
 * Counts page views with Vercel Web Analytics, where this copy turns it on
 * (NEXT_PUBLIC_VERCEL_ANALYTICS; the locale layout decides). It stays out of the page's
 * way: nothing renders while the page is prerendered or hydrates, and only a moment after
 * it has loaded does the counter's code load (Vercel's component and the redaction,
 * page-view-counter.tsx), rendering once it's there, so nothing suspends. Parts of the
 * page still streaming in, like a form someone is already typing in, hydrate as soon as
 * they would without it. Vercel's script loads after that.
 */
export function PageViews() {
  const [Counter, setCounter] = useState<ComponentType | null>(null);
  useEffect(() => {
    let active = true;
    const cancel = afterPageLoad(() => {
      import("./page-view-counter")
        .then(({ PageViewCounter }) => {
          if (active) setCounter(() => PageViewCounter);
        })
        .catch(() => {
          // Offline, say: the page just goes uncounted.
        });
    });
    return () => {
      active = false;
      cancel();
    };
  }, []);
  return Counter ? <Counter /> : null;
}
