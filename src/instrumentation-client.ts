import { z } from "zod";

import { reportBrowserError } from "@/lib/monitoring/browser-errors";

/**
 * Runs in the browser before the app does.
 *
 * Zod's faster parsing compiles validators with Function(), which the Content Security
 * Policy doesn't allow; only checking whether it may would be reported on every page.
 * Parsing the plain way costs nothing noticeable at FaceOn's sizes.
 */
z.config({ jitless: true });

/**
 * Error reports from the browser, only where this copy sets NEXT_PUBLIC_SENTRY_DSN
 * (Sentry, or GlitchTip). Their code loads once the page is idle, so it never weighs on
 * the first load; errors in the moment before wait for it (lib/monitoring/browser-errors.ts).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const early = (event: ErrorEvent) => {
    // Without the error itself (another site's script), there's nothing to go on.
    if (event.error !== undefined && event.error !== null) {
      reportBrowserError(event.error);
    }
  };
  const earlyRejection = (event: PromiseRejectionEvent) =>
    reportBrowserError(event.reason);
  window.addEventListener("error", early);
  window.addEventListener("unhandledrejection", earlyRejection);
  const start = () => {
    import("@/lib/monitoring/client")
      .then(({ startErrorReports }) => {
        // The reports' own handlers take over from here.
        window.removeEventListener("error", early);
        window.removeEventListener("unhandledrejection", earlyRejection);
        startErrorReports(dsn);
      })
      .catch(() => {
        // Reports are a help, never a requirement.
      });
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 5000 });
  } else {
    setTimeout(start, 3000);
  }
}
