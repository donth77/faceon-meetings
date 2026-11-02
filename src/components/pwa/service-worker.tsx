"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) in production builds. In development it
 * removes one left by a production run at the same address, whose cache would hold on
 * to old code.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          registrations.forEach(
            (registration) => void registration.unregister(),
          ),
        );
      return;
    }
    // "none": the browser checks for a new worker past its own cache.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // No worker (a private window, say): the app works as a plain website.
      });
  }, []);
  return null;
}
