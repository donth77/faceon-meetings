import "server-only";

import type { z } from "zod";

import { reportError } from "@/lib/monitoring/report";
import { isSameOrigin } from "@/lib/same-origin";

import {
  MEETING_ERRORS,
  type MeetingErrorBody,
  type MeetingErrorCode,
} from "./api";
import { MeetingError } from "./errors";

export function errorResponse(code: MeetingErrorCode): Response {
  const body: MeetingErrorBody = { error: { code } };
  return Response.json(body, { status: MEETING_ERRORS[code] });
}

/** The request's JSON body, validated; a malformed body is a BAD_REQUEST. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) throw new MeetingError("BAD_REQUEST");
  return parsed.data;
}

/**
 * Runs a meeting API handler: rejects cross-site requests and turns a MeetingError into
 * its JSON error. Anything unexpected is logged and reported as
 * UNAVAILABLE, without details.
 */
export async function handleMeetingRequest(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse("NOT_ALLOWED");
  try {
    return await handler();
  } catch (error) {
    if (error instanceof MeetingError) return errorResponse(error.code);
    reportError("Meeting API request failed", error);
    return errorResponse("UNAVAILABLE");
  }
}
