import type { Instrumentation } from "next";

/** Where error reports go (Sentry, or GlitchTip); without it there are none. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const reporting = () => Boolean(dsn) && process.env.NEXT_RUNTIME === "nodejs";

/**
 * Error reports from the server, where NEXT_PUBLIC_SENTRY_DSN is set. Errors only (no
 * performance tracing), each scrubbed of anything about the person first
 * (lib/monitoring/scrub.ts). Sentry's code loads only when reports are on.
 */
export async function register() {
  if (!reporting()) return;
  const [{ init }, { DATA_COLLECTION, scrubBreadcrumb, scrubEvent }] =
    await Promise.all([
      import("@sentry/nextjs"),
      import("@/lib/monitoring/scrub"),
    ]);
  init({
    dsn,
    dataCollection: DATA_COLLECTION,
    includeServerName: false,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}

/** Errors in pages, server functions and route handlers, as Next.js catches them. */
export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!reporting()) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
