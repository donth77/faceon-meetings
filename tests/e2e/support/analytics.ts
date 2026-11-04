import { devices, type BrowserContext, type Page } from "@playwright/test";

/** Vercel Web Analytics on the site itself: its script and endpoints. */
const INSIGHTS = /\/_vercel\/insights\//;

/**
 * Vercel's script, the same file Vercel serves at /_vercel/insights/script.js wherever
 * Web Analytics is on. `next start` has no /_vercel, so the tests serve it.
 */
const VERCEL_SCRIPT = "https://va.vercel-scripts.com/v1/script.js";

/**
 * Vercel's script does nothing in a browser that says it's automated: the browsers that
 * record page views look like an ordinary Chrome.
 */
export const ORDINARY_CHROME = devices["Desktop Chrome"].userAgent;

/** What Vercel's script sends for a page view. */
export type PageViewBody = Record<string, unknown> & { o: string };

/**
 * Stands in for /_vercel/insights, which `next start` doesn't serve: an empty script, so
 * pages count nothing. The fixtures give every browser this one; a page that records
 * page views sets its own (a page's route wins over its browser's).
 */
export async function standInForAnalytics(target: BrowserContext) {
  await target.route(INSIGHTS, (route) =>
    route.request().url().endsWith("/script.js")
      ? route.fulfill({ contentType: "text/javascript", body: "" })
      : route.fulfill({ status: 204 }),
  );
}

let script: Promise<string> | undefined;

/** Vercel's script, fetched once per run. */
function vercelScript(): Promise<string> {
  script ??= fetch(VERCEL_SCRIPT).then(async (response) => {
    if (!response.ok) {
      throw new Error(`${VERCEL_SCRIPT} answered ${response.status}`);
    }
    return response.text();
  });
  return script;
}

/**
 * Serves Vercel's own script on this page and records each page view it sends, with any
 * other request to /_vercel/insights (there should be none).
 */
export async function recordPageViews(page: Page) {
  const body = await vercelScript();
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "webdriver", {
      get: () => false,
    }),
  );
  const views: PageViewBody[] = [];
  const other: string[] = [];
  await page.route(INSIGHTS, async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/_vercel/insights/script.js") {
      return route.fulfill({ contentType: "text/javascript", body });
    }
    if (pathname === "/_vercel/insights/view" && request.method() === "POST") {
      views.push(request.postDataJSON() as PageViewBody);
      return route.fulfill({ status: 200, body: "OK" });
    }
    other.push(`${request.method()} ${pathname}`);
    return route.fulfill({ status: 404 });
  });
  return { views, other };
}
