import { z } from "zod";

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
 * the first load; an error in the moment before isn't reported.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const start = () => {
    import("@/lib/monitoring/client")
      .then(({ startErrorReports }) => startErrorReports(dsn))
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
