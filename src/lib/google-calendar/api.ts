import "server-only";

import { z } from "zod";

/** The host's own calendar: the only one FaceOn writes to. */
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
/** Google answers in well under a second; past this the save gives up on the calendar. */
const TIMEOUT_MS = 10_000;

const EventTime = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
});

/** Kept whole (loose), so sending the list back never drops what Google knows about a guest. */
const Attendee = z
  .object({
    email: z.string().optional(),
    organizer: z.boolean().optional(),
    self: z.boolean().optional(),
    resource: z.boolean().optional(),
  })
  .loose();
export type Attendee = z.infer<typeof Attendee>;

/** The parts of a Calendar event FaceOn reads. */
export const GoogleEvent = z.object({
  id: z.string(),
  status: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: EventTime.optional(),
  end: EventTime.optional(),
  recurrence: z.array(z.string()).optional(),
  recurringEventId: z.string().optional(),
  originalStartTime: EventTime.optional(),
  attendees: z.array(Attendee).optional(),
  extendedProperties: z
    .object({ private: z.record(z.string(), z.string()).optional() })
    .optional(),
});
export type GoogleEvent = z.infer<typeof GoogleEvent>;

const Instances = z.object({ items: z.array(GoogleEvent).default([]) });

/** A time in an event: a wall-clock time in an IANA time zone. */
export type EventTimeBody = { dateTime: string; timeZone: string };

/** What FaceOn sends to make or change an event (a patch sends only some of it). */
export type EventBody = {
  summary?: string;
  description?: string;
  location?: string;
  start?: EventTimeBody;
  end?: EventTimeBody;
  recurrence?: string[];
  attendees?: Attendee[];
  extendedProperties?: { private: Record<string, string> };
  source?: { title: string; url: string };
  status?: "confirmed";
};

/** Who Google emails about a change: everyone invited, or nobody (FaceOn's own notes). */
export type SendUpdates = "all" | "none";

/**
 * Why a call failed:
 * - `auth`: the access token was refused (expired or revoked);
 * - `scope`: the token lacks calendar access;
 * - `gone`: no such event (deleted, or in another account's calendar);
 * - `disabled`: the Calendar API is off in the Google Cloud project;
 * - `limited`: too many requests; try later;
 * - `rejected`: Google refused the request itself;
 * - `unavailable`: Google or the network failed, or the answer made no sense.
 */
export type GoogleProblem =
  | "auth"
  | "scope"
  | "gone"
  | "disabled"
  | "limited"
  | "rejected"
  | "unavailable";

export class GoogleCalendarError extends Error {
  constructor(
    readonly problem: GoogleProblem,
    readonly status: number,
    readonly reason?: string,
  ) {
    super(
      `Google Calendar ${status || "request"} failed: ${reason ?? problem}`,
    );
  }
}

/** Google's JSON error: the reasons, in `errors` (v1 style) and `details` (newer). */
const ErrorBody = z.object({
  error: z
    .object({
      status: z.string().optional(),
      errors: z
        .array(z.object({ reason: z.string().optional() }).loose())
        .optional(),
      details: z
        .array(z.object({ reason: z.string().optional() }).loose())
        .optional(),
    })
    .loose(),
});

const SCOPE_REASONS = [
  "insufficientPermissions",
  "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
];
const DISABLED_REASONS = ["accessNotConfigured", "SERVICE_DISABLED"];
const LIMIT_REASONS = [
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "quotaExceeded",
  "RATE_LIMIT_EXCEEDED",
];

/** Sorts a failed response into a problem FaceOn can act on. */
export function problemOf(
  status: number,
  body: unknown,
): { problem: GoogleProblem; reason?: string } {
  const parsed = ErrorBody.safeParse(body);
  const reasons = parsed.success
    ? [
        ...(parsed.data.error.errors ?? []).map((e) => e.reason),
        ...(parsed.data.error.details ?? []).map((d) => d.reason),
        parsed.data.error.status,
      ].filter((reason): reason is string => Boolean(reason))
    : [];
  const reason = reasons[0];
  const any = (list: string[]) => reasons.some((r) => list.includes(r));
  if (status === 401) return { problem: "auth", reason };
  if (status === 404 || status === 410) return { problem: "gone", reason };
  if (status === 429 || any(LIMIT_REASONS))
    return { problem: "limited", reason };
  if (status === 403 && any(SCOPE_REASONS)) return { problem: "scope", reason };
  if (status === 403 && any(DISABLED_REASONS)) {
    return { problem: "disabled", reason };
  }
  if (status >= 500) return { problem: "unavailable", reason };
  return { problem: "rejected", reason };
}

/** "2026-11-03T15:00:00Z": an instant as Google's APIs take it. */
const rfc3339 = (instant: Date) =>
  instant.toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * A small client for the Calendar API's events on the host's primary calendar, with
 * the host's access token. Every answer is checked before FaceOn trusts it.
 */
export function calendarApi(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
) {
  async function call(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, string>; body?: EventBody } = {},
  ): Promise<unknown> {
    const url = new URL(`${EVENTS_URL}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(options.body ? { "content-type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new GoogleCalendarError("unavailable", 0, "network");
    }
    const text = await response.text().catch(() => "");
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const { problem, reason } = problemOf(response.status, json);
      throw new GoogleCalendarError(problem, response.status, reason);
    }
    return json;
  }

  const event = (json: unknown) => {
    const parsed = GoogleEvent.safeParse(json);
    if (!parsed.success) {
      throw new GoogleCalendarError("unavailable", 200, "unexpected answer");
    }
    return parsed.data;
  };
  const one = (eventId: string) => `/${encodeURIComponent(eventId)}`;

  return {
    get: async (eventId: string) => event(await call("GET", one(eventId))),
    insert: async (body: EventBody, sendUpdates: SendUpdates) =>
      event(await call("POST", "", { query: { sendUpdates }, body })),
    patch: async (eventId: string, body: EventBody, sendUpdates: SendUpdates) =>
      event(
        await call("PATCH", one(eventId), { query: { sendUpdates }, body }),
      ),
    remove: async (eventId: string, sendUpdates: SendUpdates) => {
      await call("DELETE", one(eventId), { query: { sendUpdates } });
    },
    /** A series' occurrences between two moments, cancelled ones included. */
    instances: async (eventId: string, from: Date, to: Date) => {
      const json = await call("GET", `${one(eventId)}/instances`, {
        query: {
          timeMin: rfc3339(from),
          timeMax: rfc3339(to),
          showDeleted: "true",
          maxResults: "2500",
        },
      });
      const parsed = Instances.safeParse(json);
      if (!parsed.success) {
        throw new GoogleCalendarError("unavailable", 200, "unexpected answer");
      }
      return parsed.data.items;
    },
  };
}

export type CalendarApi = ReturnType<typeof calendarApi>;
