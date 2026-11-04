import { createHash } from "node:crypto";

import { reportCspViolation } from "@/lib/monitoring/report";
import {
  MAX_REPORT_BYTES,
  parseCspReport,
  reportLimiter,
  violationLine,
} from "@/lib/security/csp-report";

const allowed = reportLimiter({ perSource: 20, total: 300 });

/** The sender, as a hash kept only in memory for the limit. */
function source(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHash("sha256").update(ip).digest("base64url").slice(0, 16);
}

/**
 * POST /api/csp-report: browsers report Content Security Policy violations here (both
 * report-uri's format and the Reporting API's). Each goes to the server log as one line:
 * the rule, what was blocked (a keyword or a site, never a full address) and the page's
 * path with its IDs replaced. The same goes to error reports where they're on, each kind
 * once an hour (lib/monitoring/report.ts); the browser's own report never leaves FaceOn.
 * Always 204, so a page never learns more than that it sent.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_REPORT_BYTES) return new Response(null, { status: 413 });
  if (!allowed(source(request))) return new Response(null, { status: 204 });
  const body = await request.text();
  if (body.length > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 });
  }
  const violations = parseCspReport(request.headers.get("content-type"), body);
  if (violations === null) return new Response(null, { status: 400 });
  for (const violation of violations) {
    console.warn(violationLine(violation));
    reportCspViolation(violation);
  }
  return new Response(null, { status: 204 });
}
