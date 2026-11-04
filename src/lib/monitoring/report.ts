import "server-only";

import type * as Sentry from "@sentry/nextjs";
import { waitUntil } from "@vercel/functions";

import { loggable, queryFailure } from "@/lib/log";
import type { CspViolation } from "@/lib/security/csp-report";

/**
 * Error reports from code that catches its own errors. Next.js reports what it catches
 * itself (instrumentation.ts); everything a handler catches and turns into a polite answer
 * comes through here, so it isn't only in the server log, which Vercel's free plan keeps
 * for about an hour. Each report is scrubbed like every other (scrub.ts), and nothing is
 * sent without NEXT_PUBLIC_SENTRY_DSN.
 */

/** Fixed values that say more about where something failed: an HTTP status, a provider. */
export type ReportDetails = Readonly<Record<string, string | number>>;

/** Reports go out from the Node.js server, where instrumentation.ts starts them. */
const reporting = () =>
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  process.env.NEXT_RUNTIME === "nodejs";

/** How long a report may hold the function open while it's sent. */
const FLUSH_MS = 2000;

/** Sentry's SDK, loaded once, the first time something is reported. */
let sdk: Promise<typeof Sentry> | null = null;
const sentrySdk = () => (sdk ??= import("@sentry/nextjs"));

/**
 * Something the server caught and handled that shouldn't have happened: written to the
 * server log as before (a failed query without its values), and sent as an error report.
 * `what` says what failed in plain words and groups the reports, so it stays the same
 * every time: what varies goes in `details`, which become the report's tags. Expected
 * outcomes (a wrong passcode, a grant someone revoked) aren't reported.
 */
export function reportError(
  what: string,
  error?: unknown,
  details?: ReportDetails,
): void {
  const logged = [
    ...(details ? [details] : []),
    ...(error === undefined ? [] : [loggable(error)]),
  ];
  console.error(what, ...logged);
  if (!reporting()) return;
  waitUntil(sendError(what, error, details));
}

/** A thrown Error as it's safe to report: a failed query's keeps its stack, not its values. */
export function reportableError(error: Error): Error {
  const failure = queryFailure(error);
  if (!failure) return error;
  const safe = new Error(failure.message);
  safe.name = failure.name;
  // The stack's first lines repeat the message, values and all: keep only its frames.
  const frames = error.stack?.indexOf("\n    at ") ?? -1;
  safe.stack =
    frames >= 0
      ? `${failure.name}: ${failure.message}${error.stack?.slice(frames) ?? ""}`
      : `${failure.name}: ${failure.message}`;
  return safe;
}

/**
 * A report that's only words, sent as a plain event: captureMessage adds a stack to it,
 * and Sentry then titles the issue after that stack's top frame ("<anonymous>") instead
 * of the words.
 */
function captureText(
  sentry: typeof Sentry,
  message: string,
  level: Sentry.SeverityLevel,
): void {
  sentry.captureEvent({ message, level });
}

/** A tag's value as Sentry takes it: one line, at most 200 characters. */
const tagValue = (value: string | number) =>
  String(value).replace(/\s+/g, " ").slice(0, 200);

async function sendError(
  what: string,
  error: unknown,
  details: ReportDetails | undefined,
): Promise<void> {
  try {
    const sentry = await sentrySdk();
    sentry.withScope((scope) => {
      scope.setTag("failed", tagValue(what));
      for (const [key, value] of Object.entries(details ?? {})) {
        scope.setTag(key, tagValue(value));
      }
      const code = queryFailure(error)?.code;
      if (typeof code === "string") scope.setTag("db_code", tagValue(code));
      if (error instanceof Error) {
        // The same call site with different failures stays apart, by its stack.
        scope.setFingerprint(["{{ default }}", what]);
        sentry.captureException(reportableError(error));
      } else {
        scope.setFingerprint([what]);
        captureText(sentry, what, "error");
      }
    });
    await sentry.flush(FLUSH_MS);
  } catch {
    // Reports are a help, never a requirement.
  }
}

/** When each kind of violation was last sent, so a page that keeps tripping one sends it once an hour. */
const cspSent = new Map<string, number>();
const CSP_RESEND_MS = 60 * 60_000;
const CSP_KINDS_KEPT = 500;

/**
 * A Content Security Policy violation, as /api/csp-report has already reduced it: the
 * rule, what was blocked (a keyword or a site, never a full address) and the page's path
 * with its IDs replaced. Each kind goes at most once an hour from each server, as a
 * warning grouped by rule and source; the browser's own report never leaves FaceOn.
 */
export function reportCspViolation(
  violation: CspViolation,
  now = Date.now(),
): void {
  if (!reporting()) return;
  const kind = [
    violation.disposition,
    violation.directive,
    violation.blocked,
    violation.page,
  ].join(" ");
  const last = cspSent.get(kind);
  if (last !== undefined && now - last < CSP_RESEND_MS) return;
  if (cspSent.size >= CSP_KINDS_KEPT) cspSent.clear();
  cspSent.set(kind, now);
  waitUntil(sendCspViolation(violation));
}

async function sendCspViolation(violation: CspViolation): Promise<void> {
  try {
    const sentry = await sentrySdk();
    sentry.withScope((scope) => {
      scope.setTags({
        csp_directive: tagValue(violation.directive),
        csp_blocked: tagValue(violation.blocked),
        csp_page: tagValue(violation.page),
        csp_disposition: violation.disposition,
      });
      scope.setFingerprint(["csp", violation.directive, violation.blocked]);
      captureText(
        sentry,
        `Content Security Policy ${violation.disposition === "enforce" ? "blocked" : "would block"} ${violation.blocked} (${violation.directive})`,
        "warning",
      );
    });
    await sentry.flush(FLUSH_MS);
  } catch {
    // Reports are a help, never a requirement.
  }
}
