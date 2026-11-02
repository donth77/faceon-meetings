import { z } from "zod";

import { redactPath } from "./redact";

/**
 * A Content Security Policy violation as the server log keeps it: which rule, what kind
 * of thing or which site was blocked, and on which page, with no query strings,
 * fragments, IDs, code samples, IP addresses or browser details.
 */
export type CspViolation = {
  directive: string;
  blocked: string;
  page: string;
  disposition: "enforce" | "report";
};

/** The biggest report body read; browsers send a few hundred bytes per violation. */
export const MAX_REPORT_BYTES = 64 * 1024;

const Disposition = z.enum(["enforce", "report"]).optional();

/** report-uri's format (Firefox, Safari): one violation per request. */
const LegacyReport = z.object({
  "csp-report": z.object({
    "document-uri": z.string().max(4096).optional(),
    "effective-directive": z.string().max(256).optional(),
    "violated-directive": z.string().max(4096).optional(),
    "blocked-uri": z.string().max(4096).optional(),
    disposition: Disposition,
  }),
});

/** The Reporting API's (report-to, Chrome): a batch of reports of any type. */
const ReportBatch = z
  .array(
    z.object({
      type: z.string().max(64),
      body: z
        .object({
          documentURL: z.string().max(4096).optional(),
          effectiveDirective: z.string().max(256).optional(),
          blockedURL: z.string().max(4096).optional(),
          disposition: Disposition,
        })
        .optional(),
    }),
  )
  .max(100);

/** A directive's name, and nothing that came after it. */
function directiveName(value: string | undefined): string {
  const name = value?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return /^[a-z-]{1,40}$/.test(name) ? name : "unknown";
}

/**
 * What was blocked: a keyword the browser uses (inline, eval, wasm-eval…), a scheme
 * (data:, blob:), or the origin of an address, never its path or query.
 */
export function blockedSource(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (raw === "") return "unknown";
  if (URL.canParse(raw)) {
    const url = new URL(raw);
    return /^(https?|wss?):$/.test(url.protocol) ? url.origin : url.protocol;
  }
  const keyword = raw.toLowerCase();
  return /^[a-z-]{1,40}:?$/.test(keyword) ? keyword : "unknown";
}

/** The page the violation happened on, as a path with its IDs replaced. */
function pagePath(value: string | undefined): string {
  if (!value || !URL.canParse(value)) return "unknown";
  return redactPath(new URL(value).pathname).slice(0, 200);
}

/**
 * The violations in a report request's body, or null when it isn't one. Unknown fields
 * are ignored, and Reporting API batches keep only their CSP reports.
 */
export function parseCspReport(
  contentType: string | null,
  body: string,
): CspViolation[] | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  if (
    contentType?.includes("application/reports+json") ||
    Array.isArray(json)
  ) {
    const batch = ReportBatch.safeParse(json);
    if (!batch.success) return null;
    return batch.data.flatMap((report) =>
      report.type === "csp-violation" && report.body
        ? [
            {
              directive: directiveName(report.body.effectiveDirective),
              blocked: blockedSource(report.body.blockedURL),
              page: pagePath(report.body.documentURL),
              disposition: report.body.disposition ?? "report",
            },
          ]
        : [],
    );
  }
  const legacy = LegacyReport.safeParse(json);
  if (!legacy.success) return null;
  const report = legacy.data["csp-report"];
  return [
    {
      directive: directiveName(
        report["effective-directive"] ?? report["violated-directive"],
      ),
      blocked: blockedSource(report["blocked-uri"]),
      page: pagePath(report["document-uri"]),
      disposition: report.disposition ?? "report",
    },
  ];
}

/** One line in the server log. */
export const violationLine = (violation: CspViolation) =>
  `csp ${violation.disposition}: ${violation.directive} blocked ${violation.blocked} on ${violation.page}`;

/**
 * At most `perSource` reports a minute from one visitor and `total` a minute in all, per
 * server instance: a page that trips the policy over and over doesn't flood the log.
 * Counters live in memory only, so nothing is stored and the database never wakes.
 */
export function reportLimiter(
  { perSource, total }: { perSource: number; total: number },
  now: () => number = Date.now,
) {
  let windowStart = 0;
  let all = 0;
  const bySource = new Map<string, number>();
  return (source: string): boolean => {
    const time = now();
    if (time - windowStart >= 60_000) {
      windowStart = time;
      all = 0;
      bySource.clear();
    }
    const count = bySource.get(source) ?? 0;
    if (count >= perSource || all >= total) return false;
    bySource.set(source, count + 1);
    all += 1;
    return true;
  };
}
