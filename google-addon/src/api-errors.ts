import type { AddonErrorBody } from "../../src/lib/addon/google/types";

export type AddonError = AddonErrorBody["error"];

/**
 * The error in a FaceOn API response: its own JSON body, or one worked out from the
 * status when the body isn't FaceOn's (a proxy's page, say).
 */
export function errorOf(status: number, body: string): AddonError {
  try {
    const parsed = JSON.parse(body) as Partial<AddonErrorBody>;
    if (parsed.error && typeof parsed.error.code === "string")
      return parsed.error;
  } catch {
    // not JSON: fall through to the status
  }
  if (status === 401) return { code: "INVALID_TOKEN" };
  if (status === 403) return { code: "AUTHENTICATION" };
  if (status === 404) return { code: "NOT_FOUND" };
  if (status === 429) return { code: "RATE_LIMITED" };
  if (status === 400) return { code: "BAD_REQUEST" };
  return { code: "TEMPORARY" };
}
