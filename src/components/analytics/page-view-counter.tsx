"use client";

import { Analytics } from "@vercel/analytics/next";

import { INSIGHTS_PATH, pageView } from "@/lib/monitoring/page-views";

/**
 * Vercel Web Analytics, telling it each page's route instead of its address
 * (lib/monitoring/page-views.ts). The script and endpoints stay at /_vercel/insights,
 * which Vercel serves wherever Web Analytics is on: the proxy and the Content Security
 * Policy already leave it alone. (Version 2 would otherwise take an address Vercel picks
 * at build time, which the proxy's matcher can't know and would hand to the pages.)
 */
export function PageViewCounter() {
  return (
    <Analytics
      beforeSend={pageView}
      scriptSrc={`${INSIGHTS_PATH}/script.js`}
      viewEndpoint={`${INSIGHTS_PATH}/view`}
      eventEndpoint={`${INSIGHTS_PATH}/event`}
    />
  );
}
