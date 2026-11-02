import type {
  Breadcrumb,
  BrowserOptions,
  ErrorEvent,
  StackFrame,
} from "@sentry/browser";

import { redactPath, redactText, redactUrl } from "@/lib/security/redact";

/**
 * Error reports (Sentry, or GlitchTip) say what broke and where, never who it happened
 * to or what they were doing. Before a report leaves the browser or the server, these
 * strip:
 *
 * - who: no user, no IP address (sendDefaultPii is off too), no cookies or headers
 *   besides the browser's User-Agent, no server name;
 * - addresses' query strings and fragments (a meeting link's passcode travels after #),
 *   with IDs in paths replaced (/j/:code, /meetings/:code, /previous/:session);
 * - request bodies, local variables and anything extra;
 * - breadcrumbs from the console and from clicks and typing, which could carry names,
 *   chat, notes or transcript text; the others keep only redacted addresses;
 * - email addresses, keys and long numbers from error messages.
 */

/**
 * What the SDKs collect in the first place: nothing about the person. No user details
 * (so no IP address either), cookies, request or response bodies, query strings, local
 * variables or AI inputs; of the headers, only the browser's User-Agent.
 */
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent"] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies NonNullable<BrowserOptions["dataCollection"]>;

/** Contexts that describe the software, never the person: kept. */
const KEPT_CONTEXTS = new Set([
  "app",
  "browser",
  "os",
  "device",
  "runtime",
  "react",
  "trace",
]);

/** Breadcrumb data that's kept (addresses redacted); everything else goes. */
const KEPT_BREADCRUMB_DATA = new Set([
  "url",
  "from",
  "to",
  "method",
  "status_code",
]);
const ADDRESS_FIELDS = new Set(["url", "from", "to"]);

/** The page's own origin in a browser, so same-site addresses keep just their path. */
const siteOrigin = () =>
  typeof location === "undefined" ? undefined : location.origin;

const stripQuery = (address: string) => address.split(/[?#]/)[0] ?? "";

/** One breadcrumb, or null to drop it. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category ?? "";
  if (category === "console" || category.startsWith("ui.")) return null;
  const scrubbed: Breadcrumb = { ...breadcrumb };
  if (scrubbed.message !== undefined) {
    scrubbed.message = redactText(scrubbed.message);
  }
  if (breadcrumb.data) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(breadcrumb.data)) {
      if (!KEPT_BREADCRUMB_DATA.has(key)) continue;
      data[key] =
        typeof value === "string" && ADDRESS_FIELDS.has(key)
          ? redactUrl(value, siteOrigin())
          : value;
    }
    scrubbed.data = data;
  }
  return scrubbed;
}

/** A stack frame: its file's address without query or fragment, and no variables. */
function scrubFrame(frame: StackFrame): StackFrame {
  const scrubbed: StackFrame = { ...frame };
  delete scrubbed.vars;
  if (scrubbed.filename !== undefined) {
    scrubbed.filename = stripQuery(scrubbed.filename);
  }
  if (scrubbed.abs_path !== undefined) {
    scrubbed.abs_path = stripQuery(scrubbed.abs_path);
  }
  return scrubbed;
}

/** A report, scrubbed of everything about the person (see above). */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event };
  delete scrubbed.user;
  delete scrubbed.server_name;
  delete scrubbed.extra;
  if (scrubbed.message !== undefined) {
    scrubbed.message = redactText(scrubbed.message);
  }
  if (scrubbed.transaction !== undefined) {
    scrubbed.transaction = redactPath(stripQuery(scrubbed.transaction));
  }
  if (event.request) {
    const userAgent = event.request.headers?.["User-Agent"];
    scrubbed.request = {};
    if (event.request.url !== undefined) {
      scrubbed.request.url = redactUrl(event.request.url);
    }
    if (userAgent) scrubbed.request.headers = { "User-Agent": userAgent };
  }
  if (event.contexts) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(event.contexts).filter(([name]) =>
        KEPT_CONTEXTS.has(name),
      ),
    );
  }
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((exception) => {
        const copy = { ...exception };
        if (copy.value !== undefined) copy.value = redactText(copy.value);
        if (copy.stacktrace?.frames) {
          copy.stacktrace = {
            ...copy.stacktrace,
            frames: copy.stacktrace.frames.map(scrubFrame),
          };
        }
        return copy;
      }),
    };
  }
  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs.flatMap((breadcrumb) => {
      const kept = scrubBreadcrumb(breadcrumb);
      return kept ? [kept] : [];
    });
  }
  return scrubbed;
}
