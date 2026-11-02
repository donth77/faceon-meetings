import {
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  dedupeIntegration,
  eventFiltersIntegration,
  functionToStringIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  init,
  linkedErrorsIntegration,
} from "@sentry/browser";

import { DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./scrub";

/**
 * Starts error reports in this browser. instrumentation-client.ts loads this once the
 * page is idle, and only where NEXT_PUBLIC_SENTRY_DSN is set. Errors only: no
 * performance tracing, no session replay and no session counts; no console or click
 * breadcrumbs; every report scrubbed first (scrub.ts).
 */
export function startErrorReports(dsn: string): void {
  init({
    dsn,
    dataCollection: DATA_COLLECTION,
    defaultIntegrations: false,
    integrations: [
      eventFiltersIntegration(),
      functionToStringIntegration(),
      browserApiErrorsIntegration(),
      // Navigation and requests only: no clicks or typing (dom).
      breadcrumbsIntegration({ dom: false }),
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
    ],
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}
