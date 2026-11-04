/**
 * GET /api/meetings/{code}: what the meeting's page would say about an ID, so the Join
 * field can say it first. Always a 200: a missing meeting is an answer here, not an
 * error. (Kept out of api.ts, whose schemas the landing page has no need to load.)
 */
const ANSWERS = [
  "open",
  "notFound",
  "ended",
  "cancelled",
  "expired",
  "tooManyTries",
] as const;
export type MeetingLookup = { meeting: (typeof ANSWERS)[number] };

/**
 * What the Join field learns before opening a meeting: the lookup's answer, "network"
 * when the server can't be reached, or "unknown" when the answer is anything else (the
 * meeting's page then has the last word).
 */
export type LookupResult = MeetingLookup["meeting"] | "network" | "unknown";

/** Asks whether a meeting ID leads to a meeting (GET /api/meetings/{code}). */
export async function lookUpMeeting(code: string): Promise<LookupResult> {
  let response: Response;
  try {
    response = await fetch(`/api/meetings/${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
  } catch {
    return "network";
  }
  return readLookup(response.ok, await response.json().catch(() => null));
}

/** The lookup's answer from its response, checked: anything unexpected is "unknown". */
export function readLookup(ok: boolean, body: unknown): LookupResult {
  if (!ok || !body || typeof body !== "object") return "unknown";
  const { meeting } = body as Record<string, unknown>;
  return ANSWERS.find((answer) => answer === meeting) ?? "unknown";
}
