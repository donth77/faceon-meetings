import "server-only";

import { z } from "zod";

import { reportError } from "@/lib/monitoring/report";

import type { ScriptFile } from "./content";

const API = "https://script.googleapis.com/v1";

/** Why Google's Apps Script API said no. */
export type ScriptProblem =
  /** It refused the token, or the token lacks the scope: Google has to be asked again. */
  | { kind: "auth" }
  /** The person's own Apps Script API setting is off (script.google.com/home/usersettings). */
  | { kind: "userApiOff" }
  /** The Apps Script API isn't turned on in this FaceOn's Google Cloud project. */
  | { kind: "serviceDisabled"; consoleUrl: string | null }
  /** Google won't let this account do it: an organization's admin, say. */
  | { kind: "blocked" }
  /** The project isn't there any more. */
  | { kind: "missing" }
  /** Something passing, or unexpected: try again later. */
  | { kind: "failed" };

export type ScriptResult<T> =
  { ok: true; value: T } | { ok: false; problem: ScriptProblem };

/** Google's error body, the parts that say why. */
const GoogleError = z.object({
  error: z.object({
    message: z.string().optional(),
    details: z
      .array(
        z.object({
          reason: z.string().optional(),
          metadata: z.record(z.string(), z.string()).optional(),
        }),
      )
      .optional(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

/** Where Google says the API is turned on, in its error message. */
const CONSOLE_LINK =
  /https:\/\/console\.(?:developers|cloud)\.google\.com\/\S+/;

/** What an error from the Apps Script API means for the person. */
export function problemOf(status: number, body: unknown): ScriptProblem {
  if (status === 401) return { kind: "auth" };
  if (status === 404) return { kind: "missing" };
  if (status !== 403) return { kind: "failed" };
  const parsed = GoogleError.safeParse(body);
  const error = parsed.success ? parsed.data.error : undefined;
  const message = error?.message ?? "";
  const reasons = [
    ...(error?.details ?? []).map((detail) => detail.reason),
    ...(error?.errors ?? []).map((detail) => detail.reason),
  ];
  if (/User has not enabled the Apps Script API/i.test(message)) {
    return { kind: "userApiOff" };
  }
  if (
    reasons.includes("SERVICE_DISABLED") ||
    reasons.includes("accessNotConfigured") ||
    /has not been used in project|it is disabled/i.test(message)
  ) {
    const consoleUrl =
      error?.details?.find((detail) => detail.metadata?.activationUrl)?.metadata
        ?.activationUrl ??
      CONSOLE_LINK.exec(message)?.[0] ??
      null;
    return { kind: "serviceDisabled", consoleUrl };
  }
  if (
    reasons.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
    /insufficient (authentication )?scopes?/i.test(message)
  ) {
    return { kind: "auth" };
  }
  return { kind: "blocked" };
}

/** One call to the Apps Script API with the person's access token. */
async function call(
  accessToken: string,
  method: "POST" | "PUT",
  path: string,
  body: unknown,
  fetcher: typeof fetch,
): Promise<ScriptResult<unknown>> {
  let response: Response;
  try {
    response = await fetcher(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    reportError("Couldn't reach the Apps Script API.", error);
    return { ok: false, problem: { kind: "failed" } };
  }
  const text = await response.text().catch(() => "");
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON: the status says enough
  }
  if (response.ok) return { ok: true, value: json };
  const problem = problemOf(response.status, json);
  if (problem.kind === "failed") {
    const parsed = GoogleError.safeParse(json);
    // Google's own message goes to the log only.
    reportError(
      "The Apps Script API refused a request.",
      parsed.success ? parsed.data.error.message : undefined,
      { status: response.status, method, resource: path.split("/")[1] ?? "" },
    );
  }
  return { ok: false, problem };
}

const Project = z.object({ scriptId: z.string().min(1) });

/** A new, empty Apps Script project in the person's Google account (projects.create). */
export async function createProject(
  accessToken: string,
  title: string,
  fetcher: typeof fetch = fetch,
): Promise<ScriptResult<{ scriptId: string }>> {
  const result = await call(
    accessToken,
    "POST",
    "/projects",
    { title },
    fetcher,
  );
  if (!result.ok) return result;
  const parsed = Project.safeParse(result.value);
  return parsed.success
    ? { ok: true, value: { scriptId: parsed.data.scriptId } }
    : { ok: false, problem: { kind: "failed" } };
}

/** Replaces every file of a project (projects.updateContent). */
export async function updateContent(
  accessToken: string,
  scriptId: string,
  files: ScriptFile[],
  fetcher: typeof fetch = fetch,
): Promise<ScriptResult<null>> {
  const result = await call(
    accessToken,
    "PUT",
    `/projects/${encodeURIComponent(scriptId)}/content`,
    { files },
    fetcher,
  );
  return result.ok ? { ok: true, value: null } : result;
}
